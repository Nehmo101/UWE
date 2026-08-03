import "server-only";

import { createConnectorWorkflowService, prisma, readPdfTextLayer } from "@uwe/database/server";
import { isConnectorVisionAvailable, runConnectorVisionExtract } from "@uwe/ai-brain/router";
import { cropImageRegion, downscaleImageForVision } from "@uwe/assets";
import {
  assessTextLayer,
  boxToPixelRect,
  buildOcrPrompt,
  isCroppableRegionType,
  isUnlimitedOcrModel,
  joinOcrPages,
  planOcrPages,
  renderPdfPages,
  resolveDocumentOcrModel,
  stripDetectionMarkers,
  type DetectedRegion,
  type OcrPagePlan,
} from "@uwe/pdf-ocr";
import { writeCampaignImportFigure } from "./campaign-pdf-storage";

/**
 * OCR-Lauf für den Kampagnen-Import: PDF-Seiten rendern und über den
 * bestehenden `vision_extract`-Connector-Job durch Unlimited-OCR schicken.
 *
 * Bleibt bewusst hier statt im Package: der Job braucht Prisma und den
 * Connector, das Package bleibt rein. Läuft ausschließlich lokal auf dem
 * Maschinenraum-Host — es gibt keinen Cloud-Pfad, auf den das ausweichen könnte.
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

/**
 * Eine zugeschnittene Abbildung. Die Bilddaten liegen als Datei neben der PDF
 * (`index` ist ihr Schlüssel); hier steht nur, was in die JSON-Vorschau passt.
 */
export interface CampaignOcrFigure {
  index: number;
  pageNumber: number;
  type: string;
  width: number;
  height: number;
}

export interface CampaignOcrResult {
  /** Zusammengefügtes Markdown aller OCR-Seiten, mit Seiten-Markern. */
  markdown: string;
  /** Erkannte Abbildungen/Tabellen mit Seitenbezug. */
  regions: DetectedRegion[];
  /** Tatsächlich zugeschnittene und abgelegte Abbildungen. */
  figures: CampaignOcrFigure[];
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
  jobId: string;
  buffer: Buffer;
  pageCount: number;
  worldId?: string;
  onProgress?: (progress: CampaignOcrProgress) => Promise<void> | void;
}): Promise<CampaignOcrResult> {
  if (!(await isCampaignOcrAvailable())) {
    throw new CampaignOcrUnavailableError(
      "Kein Vision-Connector online — gescannte PDFs brauchen die lokale OCR auf dem Maschinenraum-Host.",
    );
  }

  const model = await documentOcrModel();
  const plan = planOcrPages(input.pageCount);
  if (plan.pages.length === 0) {
    return { markdown: "", regions: [], figures: [], model, plan, emptyPages: [] };
  }

  const pageResults: { pageNumber: number; markdown: string }[] = [];
  const regions: DetectedRegion[] = [];
  const figures: CampaignOcrFigure[] = [];
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

    // Ein Batch ist eine Seite (OCR_PAGES_PER_JOB = 1), die Zuordnung von
    // Ausgabe und Boxen zur Seite ist damit eindeutig.
    const page = rendered[0];
    const pageNumber = page?.pageNumber ?? batch[0] ?? batchIndex + 1;
    const stripped = stripDetectionMarkers(routed.text, pageNumber);
    if (stripped.markdown.trim()) {
      pageResults.push({ pageNumber, markdown: stripped.markdown });
    } else {
      emptyPages.push(...batch);
    }
    regions.push(...stripped.regions);

    if (page) {
      figures.push(...(await cropPageFigures(input.jobId, page, stripped.regions, figures.length)));
    }

    processedPages += batch.length;
    await input.onProgress?.({
      processedBatches: batchIndex + 1,
      totalBatches: plan.batches.length,
      processedPages,
    });
  }

  return {
    // Mit Seiten-Markern: der Chunker gibt sie weiter, und beim Execute steht
    // damit fest, aus welchen Seiten eine Entität stammt.
    markdown: joinOcrPages(pageResults, { pageMarkers: true }),
    regions,
    figures,
    model,
    plan,
    emptyPages,
  };
}

/**
 * Schneidet die Abbildungen einer gerenderten Seite zu und legt sie neben der
 * PDF ab. Fehlschläge einzelner Zuschnitte werden übersprungen — eine fehlende
 * Karte darf den Import nicht kippen.
 */
async function cropPageFigures(
  jobId: string,
  page: { pageNumber: number; png: Buffer; width: number; height: number },
  regions: readonly DetectedRegion[],
  startIndex: number,
): Promise<CampaignOcrFigure[]> {
  const figures: CampaignOcrFigure[] = [];
  for (const region of regions) {
    if (!isCroppableRegionType(region.type)) {
      continue;
    }
    const rect = boxToPixelRect(region.box, { width: page.width, height: page.height });
    if (!rect) {
      continue;
    }
    const cropped = await cropImageRegion({ buffer: page.png, rect });
    if (!cropped) {
      continue;
    }
    const index = startIndex + figures.length;
    await writeCampaignImportFigure(jobId, index, cropped);
    figures.push({
      index,
      pageNumber: page.pageNumber,
      type: region.type,
      width: rect.width,
      height: rect.height,
    });
  }
  return figures;
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
  /** Zugeschnittene Abbildungen, beim Execute als Assets übernommen. */
  figures: CampaignOcrFigure[];
  model: string | null;
}

/**
 * Beschafft den Text einer Kampagnen-PDF. Der Textlayer bleibt der schnelle
 * Weg; taugt er nichts (Scan, dünn, kaputte Kodierung), übernimmt die lokale
 * OCR. Das ersetzt den bisherigen harten Abbruch bei textlosen PDFs.
 */
export async function acquireCampaignPdfText(input: {
  jobId: string;
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
      figures: [],
      model: null,
    };
  }

  const ocr = await runCampaignPdfOcr({
    jobId: input.jobId,
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
  if (ocr.figures.length > 0) {
    notes.push(
      `${ocr.figures.length} Abbildungen zugeschnitten — sie werden beim Import an die passenden Seiten gehängt.`,
    );
  }

  return {
    text: ocr.markdown,
    source: "ocr",
    pageCount: layer.pageCount,
    notes,
    regions: ocr.regions,
    figures: ocr.figures,
    model: ocr.model,
  };
}
