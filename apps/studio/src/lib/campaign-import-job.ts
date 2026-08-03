import "server-only";

import { AiRouterError, routeAiRequest } from "@uwe/ai-brain";
import {
  createImportJobService,
  createUweRepositoryFromClient,
  prisma,
} from "@uwe/database/server";
import {
  buildCampaignExtractionPrompt,
  buildCampaignPreview,
  chunkCampaignText,
  dedupeEntitiesByTitle,
  MAX_CHUNKS,
  parseCampaignEntities,
  type CampaignImportPreview,
  type ExtractedCampaignEntity,
} from "@uwe/pdf-campaign-import";
import { readPageNumbers, stripPageMarkers } from "@uwe/pdf-ocr";

import { acquireCampaignPdfText, type CampaignOcrProgress } from "./campaign-pdf-ocr";
import {
  buildPreviewPayload,
  buildProgressPayload,
  type CampaignAnalysisProgress,
} from "./campaign-import-payloads";
import { deleteCampaignImportPdf, readCampaignImportPdf } from "./campaign-pdf-storage";

/**
 * Die eigentliche PDF-Analyse für den Kampagnen-Import.
 *
 * Läuft im Hintergrund über die `Job`-Queue statt synchron in der Server
 * Action: Ein Abenteuerband mit OCR ist Minuten- bis Stundenarbeit auf der
 * seriellen GPU-Lane. Synchron hieß das Timeouts, ein abgebrochener Request
 * ließ die Analyse verwaist weiterlaufen, und ein Server-Neustart mittendrin
 * hinterließ einen hängenden Fortschritt.
 *
 * Fortschritt und Ergebnis landen wie zuvor in `ImportJob.previewPayload` —
 * das Panel pollt unverändert weiter.
 */

/** Payload-Kennung, an der `runImportJob` diesen Lauf erkennt. */
export const CAMPAIGN_PDF_ANALYSIS_KIND = "campaign_pdf_analysis";

export interface CampaignPdfAnalysisPayload {
  kind: typeof CAMPAIGN_PDF_ANALYSIS_KIND;
  /** Die `ImportJob`-ID — nicht zu verwechseln mit der `Job`-ID der Queue. */
  importJobId: string;
  campaignContext: string;
  worldId: string | null;
  maxBytes: number;
}

export function isCampaignPdfAnalysisPayload(
  payload: unknown,
): payload is CampaignPdfAnalysisPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { kind?: unknown }).kind === CAMPAIGN_PDF_ANALYSIS_KIND &&
    typeof (payload as { importJobId?: unknown }).importJobId === "string"
  );
}

function importJobs() {
  return createImportJobService(prisma);
}

async function writeProgress(
  importJobId: string,
  progress: CampaignAnalysisProgress,
): Promise<void> {
  await importJobs().updateJob(importJobId, { previewPayload: buildProgressPayload(progress) });
}

function mockEntityForChunk(chunk: string, index: number): ExtractedCampaignEntity {
  return {
    kind: "note",
    title: "Mock-Entität " + (index + 1),
    summary: "Lokale Mock-Vorschau für den PDF-Kampagnenimport.",
    body: chunk.slice(0, 2_000),
    tags: ["PDF-Import", "Mock"],
  };
}

/** Schreibt eine leere Vorschau mit Fehlermeldung und markiert den Job als gescheitert. */
export async function markCampaignPreviewFailed(
  importJobId: string,
  message: string,
): Promise<CampaignImportPreview> {
  const preview: CampaignImportPreview = {
    ...buildCampaignPreview([]),
    errors: [message],
    canExecute: false,
  };
  await importJobs().updateJob(importJobId, {
    previewPayload: buildPreviewPayload(preview, { aiRoute: "local_engine" }),
  });
  await importJobs().markFailed(importJobId, message);
  return preview;
}

/** Minimaler Ausschnitt des Job-Runner-Kontexts, den dieser Lauf braucht. */
export interface CampaignAnalysisJobContext {
  jobId: string;
  job: { payload: unknown };
  jobs: {
    updateProgress: (jobId: string, progress: number, label: string) => Promise<unknown>;
    isCancelled: (jobId: string) => Promise<boolean>;
  };
}

/**
 * Einstieg aus `runImportJob`. Der Rückgabewert landet in `Job.result` und
 * dient nur der Nachvollziehbarkeit — die eigentliche Vorschau hängt am
 * `ImportJob`, wo das Panel sie erwartet.
 */
export async function runCampaignPdfAnalysisJob(
  ctx: CampaignAnalysisJobContext,
): Promise<Record<string, unknown>> {
  const payload = ctx.job.payload;
  if (!isCampaignPdfAnalysisPayload(payload)) {
    throw new Error("Kampagnen-Analyse-Payload unvollständig.");
  }

  const preview = await runCampaignPdfAnalysis(payload, {
    onJobProgress: async (percent, label) => {
      await ctx.jobs.updateProgress(ctx.jobId, percent, label);
    },
    assertRunning: async () => {
      if (await ctx.jobs.isCancelled(ctx.jobId)) {
        throw new Error("Job wurde abgebrochen.");
      }
    },
  });

  return {
    importJobId: payload.importJobId,
    entities: preview.totalDocuments,
    errors: preview.errors.length,
  };
}

export interface CampaignAnalysisHooks {
  /** Grober Queue-Fortschritt (0–100) für die Job-Übersicht. */
  onJobProgress?: (percent: number, label: string) => Promise<void> | void;
  /** Prüft zwischen den Schritten, ob der Job abgebrochen wurde. */
  assertRunning?: () => Promise<void>;
}

/**
 * Führt die Analyse aus. Wirft nicht: Fehler landen als Vorschau-Fehler am
 * Import-Job, damit das Panel sie anzeigen kann.
 */
export async function runCampaignPdfAnalysis(
  input: CampaignPdfAnalysisPayload,
  hooks: CampaignAnalysisHooks = {},
): Promise<CampaignImportPreview> {
  const { importJobId } = input;

  const buffer = await readCampaignImportPdf(importJobId);
  if (!buffer) {
    return markCampaignPreviewFailed(
      importJobId,
      "Keine hochgeladene PDF gefunden — bitte zuerst die PDF-Datei hochladen.",
    );
  }
  if (buffer.length > input.maxBytes) {
    return markCampaignPreviewFailed(
      importJobId,
      `PDF-Datei ist zu groß (max. ${Math.floor(input.maxBytes / (1024 * 1024))} MB).`,
    );
  }

  const startedAt = new Date().toISOString();
  try {
    await writeProgress(importJobId, {
      phase: "extracting",
      processedChunks: 0,
      totalChunks: null,
      startedAt,
    });
    await hooks.onJobProgress?.(5, "Text aus der PDF gewinnen");

    const acquired = await acquireCampaignPdfText({
      jobId: importJobId,
      buffer,
      maxBytes: input.maxBytes,
      ...(input.worldId ? { worldId: input.worldId } : {}),
      onOcrProgress: async (ocrProgress: CampaignOcrProgress) => {
        await writeProgress(importJobId, {
          phase: "ocr",
          processedChunks: ocrProgress.processedBatches,
          totalChunks: ocrProgress.totalBatches,
          startedAt,
        });
        const share = ocrProgress.totalBatches
          ? ocrProgress.processedBatches / ocrProgress.totalBatches
          : 0;
        await hooks.onJobProgress?.(5 + Math.round(share * 35), "Seiten per OCR lesen");
      },
    });

    const text = acquired.text;
    if (!text.trim()) {
      return markCampaignPreviewFailed(
        importJobId,
        "Aus der PDF ließ sich kein Text gewinnen — weder Textlayer noch OCR haben etwas geliefert.",
      );
    }

    // Überschriften-Schnitt, sobald die Extraktion Struktur liefert (OCR-Pfad);
    // bei flachem Textlayer bleibt es beim bisherigen Absatz-Schnitt.
    const chunks = chunkCampaignText(text);
    const useMock = process.env.NODE_ENV !== "production" && process.env.AI_USE_MOCK === "true";
    const repo = createUweRepositoryFromClient(prisma);
    const extracted: ExtractedCampaignEntity[] = [];

    await writeProgress(importJobId, {
      phase: "analyzing",
      processedChunks: 0,
      totalChunks: chunks.length,
      startedAt,
    });

    for (const [index, chunk] of chunks.entries()) {
      await hooks.assertRunning?.();

      // Herkunftsseiten merken, Marker aber nie mitschicken — die lokale KI
      // soll den Kommentar nicht als Inhalt missverstehen.
      const sourcePages = readPageNumbers(chunk);
      const promptChunk = stripPageMarkers(chunk);
      const routed = await routeAiRequest(
        { repo, prisma },
        {
          providerMode: "local_engine",
          contextMode: "general_chat",
          taskType: "create_knowledge_text",
          userPrompt: buildCampaignExtractionPrompt(promptChunk, input.campaignContext),
          useMock,
          maxTokens: 4_096,
        },
      );
      const chunkEntities = parseCampaignEntities(routed.result.text);
      const withPages = (
        useMock && chunkEntities.length === 0
          ? [mockEntityForChunk(promptChunk, index)]
          : chunkEntities
      ).map((entity) => (sourcePages.length > 0 ? { ...entity, sourcePages } : entity));
      extracted.push(...withPages);

      await writeProgress(importJobId, {
        phase: "analyzing",
        processedChunks: index + 1,
        totalChunks: chunks.length,
        startedAt,
      });
      await hooks.onJobProgress?.(
        40 + Math.round(((index + 1) / Math.max(1, chunks.length)) * 55),
        `Abschnitt ${index + 1} von ${chunks.length}`,
      );
    }

    const entities = dedupeEntitiesByTitle(extracted);
    const basePreview = buildCampaignPreview(entities, acquired.notes);
    const preview =
      entities.length > 0
        ? basePreview
        : {
            ...basePreview,
            errors: ["Lokale KI hat keine gültigen Kampagnen-Entitäten geliefert."],
            canExecute: false,
          };

    const processedCharacters = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const extractionMeta = {
      aiRoute: "local_engine",
      textSource: acquired.source,
      ocrModel: acquired.model,
      pageCount: acquired.pageCount,
      detectedRegions: acquired.regions.length,
      figures: acquired.figures,
      chunkCount: chunks.length,
      maxChunks: MAX_CHUNKS,
      sourceCharacters: text.length,
      processedCharacters,
      truncated: chunks.length === MAX_CHUNKS && processedCharacters < text.trim().length,
      useMock,
      campaignContext: input.campaignContext || null,
    };

    await importJobs().updateJob(importJobId, {
      status: "preview",
      previewPayload: buildPreviewPayload(preview, extractionMeta),
      errorMessage: null,
    });
    if (entities.length > 0) {
      // Erfolgreiche Analyse: die (bis zu 300 MB große) Roh-PDF wird nicht mehr
      // gebraucht. Bei leerem Ergebnis bleibt sie für einen neuen Versuch mit
      // anderem Kontext liegen. Die Zuschnitte bleiben bis zum Execute liegen.
      await deleteCampaignImportPdf(importJobId);
    }
    return preview;
  } catch (error) {
    // CampaignOcrUnavailableError trägt bereits eine fertige Nutzermeldung und
    // fällt hier unter `instanceof Error`.
    const message =
      error instanceof AiRouterError
        ? "Der lokale Maschinenraum ist offline — der Kampagnen-Import kann nicht in die Cloud ausweichen."
        : error instanceof Error
          ? error.message
          : "PDF-Kampagnenvorschau fehlgeschlagen.";
    return markCampaignPreviewFailed(importJobId, message);
  }
}
