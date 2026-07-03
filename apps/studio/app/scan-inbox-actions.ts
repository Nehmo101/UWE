"use server";

import { revalidatePath } from "next/cache";
import {
  createConnectorService,
  extractPdfText,
  prisma,
} from "@uwe/database/server";
import {
  createScanInboxService,
  SCAN_FILING_TARGET_LABELS,
  type ScanFilingTarget,
} from "@uwe/scan-inbox";
import { assertStudioTrusted } from "@/src/lib/authz";
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
  assertStudioTrusted();
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
  assertStudioTrusted();
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

  // TODO(scan-inbox): Bild vor dem Enqueue serverseitig downscalen (<=1600px JPEG)
  // und das vision_extract-Ergebnis in einer Folge-Iteration via
  // waitForConnectorJob zurueckschreiben (applyAnalysis mit ocrEngine "vision_llm").
  const base64 = buffer.toString("base64");
  const job = await createConnectorService(prisma).enqueueJob({
    type: "vision_extract",
    payload: { prompt: VISION_PROMPT, images: [base64] },
  });
  await service().setConnectorJob(id, job.id);
  revalidate(id);
}

/** Legt den Scan beim bestätigten Ziel ab — nur auf explizite Owner-Aktion. */
export async function fileScanAction(formData: FormData): Promise<void> {
  assertStudioTrusted();
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
  assertStudioTrusted();
  const id = String(formData.get("id"));
  await service().reject(id);
  revalidate(id);
}

export async function archiveScanAction(formData: FormData): Promise<void> {
  assertStudioTrusted();
  const id = String(formData.get("id"));
  await service().archive(id);
  revalidate(id);
}
