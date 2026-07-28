import "server-only";

import { createConnectorWorkflowService, prisma, readPdfTextLayer } from "@uwe/database/server";
import { isConnectorVisionAvailable, runConnectorVisionExtract } from "@uwe/ai-brain/router";
import { downscaleImageForVision } from "@uwe/assets";
import {
  assessTextLayer,
  buildOcrPrompt,
  isUnlimitedOcrModel,
  joinOcrPages,
  planOcrPages,
  renderPdfPages,
  resolveDocumentOcrModel,
  stripDetectionMarkers,
  type DetectedRegion,
  type OcrPagePlan,
} from "@uwe/pdf-ocr";

/**
 * OCR-Lauf für den Kampagnen-Import: PDF-Seiten rendern und über den
 * bestehenden `vision_extract`-Connector-Job durch Unlimited-OCR schicken.
 *
 * Bleibt bewusst hier statt im Package: der Job braucht Prisma und den
 * Connector, das Package bleibt rein. Läuft ausschließlich lokal auf dem
 * RTX-Host — es gibt keinen Cloud-Pfad, auf den das ausweichen könnte.
 */

/** Zeitbudget pro Vision-Job. Dokument-OCR ist deutlich langsamer als ein Bild-Blick. */
const OCR_JOB_TIMEOUT_MS = 10 * 60 * 1000;

/** Kontextfenster des Modells sind 32K — 8K Ausgabe pro Batch ist reichlich. */
const OCR_MAX_TOKENS = 8_192;

export interface CampaignOcrProgress {
  processedBatches: number;
  totalBatches: number;
  processedPages: number;
}

export interface CampaignOcrResult {
  /** Zusammengefügtes Markdown aller OCR-Seiten. */
  markdown: string;
  /** Erkannte Abbildungen/Tabellen mit Seitenbezug. */
  regions: DetectedRegion[];
  model: string;
  plan: OcrPagePlan;
  /** Seiten, die kein Ergebnis geliefert haben (Modell lieferte leeren Text). */
  emptyPages: number[];
}

export class CampaignOcrUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignOcrUnavailableError";
  }
}

/** Liest den `vision`-Workflow-Slot und fällt auf Unlimited-OCR zurück. */
export async function documentOcrModel(): Promise<string> {
  const slotDefault = await createConnectorWorkflowService(prisma).getDefault("vision");
  return resolveDocumentOcrModel(slotDefault?.model?.name);
}

/** True, wenn ein Connector online ist, der lokale Vision/OCR anbietet. */
export async function isCampaignOcrAvailable(): Promise<boolean> {
  return isConnectorVisionAvailable(prisma);
}

/**
 * Rendert die geplanten Seiten und lässt sie batchweise durch das Modell
 * laufen. `onProgress` wird nach jedem Batch aufgerufen, damit die Vorschau
 * denselben Fortschrittsbalken bedienen kann wie die Chunk-Analyse.
 */
export async function runCampaignPdfOcr(input: {
  buffer: Buffer;
  pageCount: number;
  worldId?: string;
  onProgress?: (progress: CampaignOcrProgress) => Promise<void> | void;
}): Promise<CampaignOcrResult> {
  if (!(await isCampaignOcrAvailable())) {
    throw new CampaignOcrUnavailableError(
      "Kein Vision-Connector online — gescannte PDFs brauchen die lokale OCR auf dem RTX-Host.",
    );
  }

  const model = await documentOcrModel();
  const plan = planOcrPages(input.pageCount);
  if (plan.pages.length === 0) {
    return { markdown: "", regions: [], model, plan, emptyPages: [] };
  }

  const pageResults: { pageNumber: number; markdown: string }[] = [];
  const regions: DetectedRegion[] = [];
  const emptyPages: number[] = [];
  let processedPages = 0;

  for (const [batchIndex, batch] of plan.batches.entries()) {
    const rendered = await renderPdfPages(input.buffer, { pages: batch });

    // Als JPEG verkleinern: die Connector-Queue transportiert Base64-JSON, und
    // ein PNG einer dichten Buchseite ist dafür um ein Vielfaches zu groß.
    const images: string[] = [];
    for (const page of rendered) {
      const downscaled = await downscaleImageForVision({
        buffer: page.png,
        mimeType: "image/png",
      });
      images.push(downscaled.buffer.toString("base64"));
    }

    if (images.length === 0) {
      emptyPages.push(...batch);
      continue;
    }

    const routed = await runConnectorVisionExtract(prisma, {
      prompt: buildOcrPrompt({ pageCount: images.length, model }),
      images,
      model,
      mimeType: "image/jpeg",
      maxTokens: OCR_MAX_TOKENS,
      timeoutMs: OCR_JOB_TIMEOUT_MS,
      ...(input.worldId ? { worldId: input.worldId } : {}),
    });

    // Mehrseitige Batches liefern eine zusammenhängende Ausgabe; die Boxen
    // werden deshalb der ersten Seite des Batches zugeordnet. Das reicht,
    // solange `regions` nur gezählt und nicht zugeschnitten wird — für einen
    // echten Zuschnitt bräuchte es Batches von einer Seite.
    const stripped = stripDetectionMarkers(routed.text, rendered[0]?.pageNumber ?? batch[0] ?? 1);
    if (stripped.markdown.trim()) {
      pageResults.push({
        pageNumber: rendered[0]?.pageNumber ?? batch[0] ?? batchIndex + 1,
        markdown: stripped.markdown,
      });
    } else {
      emptyPages.push(...batch);
    }
    regions.push(...stripped.regions);

    processedPages += batch.length;
    await input.onProgress?.({
      processedBatches: batchIndex + 1,
      totalBatches: plan.batches.length,
      processedPages,
    });
  }

  return { markdown: joinOcrPages(pageResults), regions, model, plan, emptyPages };
}

/** Für Meldungen in der Vorschau: sagt, ob wirklich das OCR-Modell lief. */
export function describeOcrModel(model: string): string {
  return isUnlimitedOcrModel(model)
    ? `Unlimited-OCR (${model})`
    : `${model} — kein Dokumenten-OCR-Modell, die Layout-Treue ist eingeschränkt`;
}

export interface AcquiredCampaignText {
  text: string;
  /** "text_layer" oder "ocr" — landet als Provenienz in der Vorschau. */
  source: "text_layer" | "ocr";
  pageCount: number;
  /** Hinweise für den Nutzer (OCR-Grund, Seiten-Cap, leere Seiten). */
  notes: string[];
  regions: DetectedRegion[];
  model: string | null;
}

/**
 * Beschafft den Text einer Kampagnen-PDF. Der Textlayer bleibt der schnelle
 * Weg; taugt er nichts (Scan, dünn, kaputte Kodierung), übernimmt die lokale
 * OCR. Das ersetzt den bisherigen harten Abbruch bei textlosen PDFs.
 */
export async function acquireCampaignPdfText(input: {
  buffer: Buffer;
  maxBytes: number;
  worldId?: string;
  onOcrProgress?: (progress: CampaignOcrProgress) => Promise<void> | void;
}): Promise<AcquiredCampaignText> {
  const layer = await readPdfTextLayer(input.buffer, { maxBytes: input.maxBytes });
  const assessment = assessTextLayer({ text: layer.text, pageCount: layer.pageCount });

  if (!assessment.needsOcr) {
    return {
      text: layer.text,
      source: "text_layer",
      pageCount: layer.pageCount,
      notes: [],
      regions: [],
      model: null,
    };
  }

  const ocr = await runCampaignPdfOcr({
    buffer: input.buffer,
    pageCount: layer.pageCount,
    ...(input.worldId ? { worldId: input.worldId } : {}),
    ...(input.onOcrProgress ? { onProgress: input.onOcrProgress } : {}),
  });

  const notes = [`${assessment.reason} Die Seiten liefen durch ${describeOcrModel(ocr.model)}.`];
  if (ocr.plan.truncated) {
    notes.push(
      `Nur die ersten ${ocr.plan.pages.length} von ${ocr.plan.totalPages} Seiten wurden gelesen — ${ocr.plan.skippedPages} Seiten übersprungen.`,
    );
  }
  if (ocr.emptyPages.length > 0) {
    notes.push(`Ohne Ergebnis blieben die Seiten: ${ocr.emptyPages.join(", ")}.`);
  }

  return {
    text: ocr.markdown,
    source: "ocr",
    pageCount: layer.pageCount,
    notes,
    regions: ocr.regions,
    model: ocr.model,
  };
}
