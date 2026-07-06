"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { revalidatePath } from "next/cache";
import {
  createConnectorService,
  extractPdfText,
  prisma,
} from "@uwe/database/server";
import { downscaleImageForVision } from "@uwe/assets";
import {
  createScanInboxService,
  SCAN_FILING_TARGET_LABELS,
  type ScanFilingTarget,
} from "@uwe/scan-inbox";
import { readScanFileBuffer } from "@/app/scan-inbox/scan-file";

const VISION_PROMPT =
  "Transkribiere den Text dieses Dokuments wörtlich und vollständig. " +
  "Gib ausschließlich den erkannten Text zurück, ohne Erklärungen oder Formatierung.";

function service() {
  return createScanInboxService(prisma);
}

function isFilingTarget(value: string): value is ScanFilingTarget {
  return Object.prototype.hasOwnProperty.call(SCAN_FILING_TARGET_LABELS, value);
}

function revalidate(id: string): void {
  revalidatePath("/scan-inbox");
  revalidatePath(`/scan-inbox/${id}`);
}

/**
 * Primärer, immer verfügbarer Weg: manuell (oder per Auto-OCR) beschaffter Text
 * wird analysiert und ein Ablage-Vorschlag gebaut. Funktioniert ohne RTX.
 */
export async function analyzeWithTextAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const id = String(formData.get("id"));
  const text = String(formData.get("ocrText") ?? "");
  await service().applyAnalysis(id, { ocrText: text, ocrEngine: "manual" });
  revalidate(id);
}

/**
 * Best-effort Auto-OCR: PDF-Textlayer wenn möglich, sonst Connector-Vision.
 * Ohne Online-Vision-Connector wird der Scan auf `waiting_for_rtx` gesetzt.
 */
export async function autoAnalyzeAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const id = String(formData.get("id"));
  const scan = await service().get(id);
  if (!scan) throw new Error("Scan nicht gefunden.");

  if (scan.mimeType === "application/pdf") {
    const buffer = await readScanFileBuffer(id);
    if (buffer) {
      try {
        const text = await extractPdfText(buffer);
        if (text.trim()) {
          await service().applyAnalysis(id, { ocrText: text, ocrEngine: "pdf_text" });
          revalidate(id);
          return;
        }
      } catch {
        // Kein Textlayer im PDF — weiter zum Vision-Pfad.
      }
    }
  }

  const summary = await createConnectorService(prisma).summarize();
  if (summary.onlineCount === 0 || !summary.availableCapabilities.includes("vision_local")) {
    await service().markWaitingForRtx(id, "Kein Vision-Connector online");
    revalidate(id);
    return;
  }

  const buffer = await readScanFileBuffer(id);
  if (!buffer) {
    await service().markWaitingForRtx(id, "Scan-Datei nicht lesbar");
    revalidate(id);
    return;
  }

  // Bild vor dem Enqueue serverseitig downscalen (<=1600px JPEG), damit die
  // Base64-Payload klein bleibt, die als JSON durch die Connector-Queue reist.
  // Das Ergebnis wird poll-on-demand via finalizeScanAction zurueckgeschrieben.
  const vision = await downscaleImageForVision({ buffer, mimeType: scan.mimeType });
  const base64 = vision.buffer.toString("base64");
  const job = await createConnectorService(prisma).enqueueJob({
    type: "vision_extract",
    payload: { prompt: VISION_PROMPT, images: [base64] },
  });
  await service().setConnectorJob(id, job.id);
  revalidate(id);
}

/**
 * Holt das Ergebnis eines laufenden Vision-Jobs ab (Poll-on-demand) und schreibt
 * den erkannten Text via Analyse zurück. Läuft der Job noch, bleibt `analyzing`.
 */
export async function finalizeScanAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const id = String(formData.get("id"));
  await service().applyConnectorJobResult(id);
  revalidate(id);
}

/** Markiert den Scan als DnD-Modus und ordnet ihn einer Welt zu (für DnD-Ablage). */
export async function setScanDndWorldAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const id = String(formData.get("id"));
  const worldId = String(formData.get("worldId") || "").trim();
  if (!worldId) throw new Error("Keine Welt gewählt.");
  await service().setDndWorld(id, worldId);
  revalidate(id);
}

/** Legt den Scan beim bestätigten Ziel ab — nur auf explizite Owner-Aktion. */
export async function fileScanAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const id = String(formData.get("id"));
  const targetRaw = String(formData.get("target") ?? "");
  if (!isFilingTarget(targetRaw)) {
    throw new Error("Unbekanntes Ablage-Ziel.");
  }
  await service().file(id, targetRaw);
  revalidate(id);
  revalidatePath("/today");
  revalidatePath("/contracts");
  revalidatePath("/capture");
}

export async function rejectScanAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const id = String(formData.get("id"));
  await service().reject(id);
  revalidate(id);
}

export async function archiveScanAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  const id = String(formData.get("id"));
  await service().archive(id);
  revalidate(id);
}
