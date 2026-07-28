"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { AiRouterError, routeAiRequest } from "@uwe/ai-brain";
import {
  createImportJobService,
  createUndoService,
  createUweRepositoryFromClient,
  pickUniqueSlug,
  prisma,
  slugifyPageTitle,
} from "@uwe/database/server";
import { acquireCampaignPdfText, type CampaignOcrProgress } from "@/src/lib/campaign-pdf-ocr";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  buildCampaignExtractionPrompt,
  buildCampaignPreview,
  chunkCampaignText,
  dedupeEntitiesByTitle,
  entityToCreatePageInput,
  MAX_CAMPAIGN_CONTEXT_CHARACTERS,
  MAX_CAMPAIGN_PDF_BYTES,
  MAX_CHUNKS,
  parseCampaignEntities,
  toCampaignPreviewSummary,
  type CampaignImportPreview,
  type CampaignImportPreviewSummary,
  type ExtractedCampaignEntity,
} from "@uwe/pdf-campaign-import";
import {
  buildPreviewPayload,
  buildProgressPayload,
  jobToCampaignStatus,
  readAnalysisProgress,
  readCampaignMetadata,
  readPdfFileName,
  readPreviewEntities,
  readStoredPreview,
  type CampaignAnalysisProgress,
  type CampaignPdfJobStatus,
} from "@/src/lib/campaign-import-payloads";
import {
  deleteCampaignImportPdf,
  hasCampaignImportPdf,
  readCampaignImportPdf,
} from "@/src/lib/campaign-pdf-storage";
import { revalidatePath } from "next/cache";

/**
 * Eine laufende Analyse schreibt nach jedem Chunk Fortschritt; bleibt der Job
 * länger als diese Spanne ohne Update, gilt die Analyse als abgebrochen
 * (z. B. Server-Neustart) und darf neu gestartet werden.
 */
const STALE_ANALYSIS_MS = 3 * 60 * 1000;

function importJobs() {
  return createImportJobService(prisma);
}

async function requireCampaignPdfJob(jobId: string) {
  const job = await importJobs().getJob(jobId);
  if (!job) {
    throw new Error("Import-Job nicht gefunden.");
  }
  if (job.sourceType !== "pdf" || job.targetType !== "campaign") {
    throw new Error("Dieser Import-Job ist kein PDF-zu-Kampagne-Import.");
  }
  return job;
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

async function writeProgress(jobId: string, progress: CampaignAnalysisProgress): Promise<void> {
  await importJobs().updateJob(jobId, { previewPayload: buildProgressPayload(progress) });
}

async function markPreviewFailed(
  jobId: string,
  message: string,
): Promise<{ preview: CampaignImportPreviewSummary }> {
  const preview: CampaignImportPreview = {
    ...buildCampaignPreview([]),
    errors: [message],
    canExecute: false,
  };
  await importJobs().updateJob(jobId, {
    previewPayload: buildPreviewPayload(preview, { aiRoute: "local_rtx" }),
  });
  await importJobs().markFailed(jobId, message);
  revalidatePath("/import");
  return { preview: toCampaignPreviewSummary(preview) };
}

/** Poll-Endpunkt für das Panel: Upload-/Analyse-/Vorschau-Zustand des Jobs. */
export async function getImportCampaignJobStatusAction(
  jobId: string,
): Promise<CampaignPdfJobStatus> {
  await requireStudioActionAuth();
  const job = await requireCampaignPdfJob(jobId);
  return jobToCampaignStatus(job, await hasCampaignImportPdf(jobId));
}

export async function previewImportCampaignPdfJobAction(
  jobId: string,
  campaignContext = "",
): Promise<{ preview: CampaignImportPreviewSummary }> {
  await requireStudioActionAuth();

  const job = await requireCampaignPdfJob(jobId);
  const storedPreview = readStoredPreview(job.previewPayload);
  if (storedPreview && storedPreview.totalDocuments > 0) {
    return { preview: toCampaignPreviewSummary(storedPreview) };
  }

  const runningProgress = readAnalysisProgress(job.previewPayload);
  if (runningProgress && Date.now() - job.updatedAt.getTime() < STALE_ANALYSIS_MS) {
    throw new Error("Die Analyse läuft bereits — der Fortschritt wird im Panel angezeigt.");
  }

  const normalizedCampaignContext = campaignContext.trim();
  if (normalizedCampaignContext.length > MAX_CAMPAIGN_CONTEXT_CHARACTERS) {
    throw new Error(
      `Der Kampagnen-Kontext darf höchstens ${MAX_CAMPAIGN_CONTEXT_CHARACTERS} Zeichen lang sein.`,
    );
  }

  const buffer = await readCampaignImportPdf(jobId);
  if (!buffer) {
    throw new Error("Keine hochgeladene PDF gefunden — bitte zuerst die PDF-Datei hochladen.");
  }
  if (buffer.length > MAX_CAMPAIGN_PDF_BYTES) {
    return markPreviewFailed(
      jobId,
      `PDF-Datei ist zu groß (max. ${Math.floor(MAX_CAMPAIGN_PDF_BYTES / (1024 * 1024))} MB).`,
    );
  }

  const startedAt = new Date().toISOString();
  try {
    await writeProgress(jobId, {
      phase: "extracting",
      processedChunks: 0,
      totalChunks: null,
      startedAt,
    });
    const acquired = await acquireCampaignPdfText({
      buffer,
      maxBytes: MAX_CAMPAIGN_PDF_BYTES,
      ...(job.targetWorldId ? { worldId: job.targetWorldId } : {}),
      onOcrProgress: async (ocrProgress: CampaignOcrProgress) => {
        await writeProgress(jobId, {
          phase: "ocr",
          processedChunks: ocrProgress.processedBatches,
          totalChunks: ocrProgress.totalBatches,
          startedAt,
        });
      },
    });
    const text = acquired.text;
    if (!text.trim()) {
      return markPreviewFailed(
        jobId,
        "Aus der PDF ließ sich kein Text gewinnen — weder Textlayer noch OCR haben etwas geliefert.",
      );
    }
    // Überschriften-Schnitt, sobald die Extraktion Struktur liefert (OCR-Pfad);
    // bei flachem Textlayer bleibt es beim bisherigen Absatz-Schnitt.
    const chunks = chunkCampaignText(text);
    const useMock = process.env.NODE_ENV !== "production" && process.env.AI_USE_MOCK === "true";
    const repo = createUweRepositoryFromClient(prisma);
    const extracted: ExtractedCampaignEntity[] = [];

    await writeProgress(jobId, {
      phase: "analyzing",
      processedChunks: 0,
      totalChunks: chunks.length,
      startedAt,
    });

    for (const [index, chunk] of chunks.entries()) {
      const routed = await routeAiRequest(
        { repo, prisma },
        {
          providerMode: "local_rtx",
          contextMode: "general_chat",
          taskType: "create_knowledge_text",
          userPrompt: buildCampaignExtractionPrompt(chunk, normalizedCampaignContext),
          useMock,
          maxTokens: 4_096,
        },
      );
      const chunkEntities = parseCampaignEntities(routed.result.text);
      extracted.push(
        ...(useMock && chunkEntities.length === 0
          ? [mockEntityForChunk(chunk, index)]
          : chunkEntities),
      );
      await writeProgress(jobId, {
        phase: "analyzing",
        processedChunks: index + 1,
        totalChunks: chunks.length,
        startedAt,
      });
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
      aiRoute: "local_rtx",
      textSource: acquired.source,
      ocrModel: acquired.model,
      pageCount: acquired.pageCount,
      detectedRegions: acquired.regions.length,
      chunkCount: chunks.length,
      maxChunks: MAX_CHUNKS,
      sourceCharacters: text.length,
      processedCharacters,
      truncated: chunks.length === MAX_CHUNKS && processedCharacters < text.trim().length,
      useMock,
      campaignContext: normalizedCampaignContext || null,
    };

    await importJobs().updateJob(jobId, {
      status: "preview",
      previewPayload: buildPreviewPayload(preview, extractionMeta),
      errorMessage: null,
    });
    if (entities.length > 0) {
      // Erfolgreiche Analyse: die (bis zu 300 MB große) Roh-PDF wird nicht
      // mehr gebraucht. Bei leerem Ergebnis bleibt sie für einen neuen
      // Versuch mit anderem Kontext liegen.
      await deleteCampaignImportPdf(jobId);
    }
    revalidatePath("/import");
    return { preview: toCampaignPreviewSummary(preview) };
  } catch (error) {
    // CampaignOcrUnavailableError trägt bereits eine fertige Nutzermeldung und
    // fällt hier unter `instanceof Error`.
    const message =
      error instanceof AiRouterError
        ? "Lokale RTX ist offline — der Kampagnen-Import kann nicht in die Cloud ausweichen."
        : error instanceof Error
          ? error.message
          : "PDF-Kampagnenvorschau fehlgeschlagen.";
    return markPreviewFailed(jobId, message);
  }
}

export async function executeImportCampaignPdfJobAction(
  jobId: string,
  itemIds: string[],
): Promise<{ resultSummary: Record<string, unknown>; undoToken: string | null }> {
  await requireStudioActionAuth();

  const job = await requireCampaignPdfJob(jobId);
  if (job.status !== "preview") {
    throw new Error("Der Kampagnen-Import benötigt zuerst eine gültige Vorschau.");
  }
  const entities = readPreviewEntities(job.previewPayload);
  if (!entities) {
    throw new Error("Gespeicherte Kampagnen-Entitäten fehlen.");
  }
  const context = readCampaignMetadata(job.metadata, job.targetWorldId);
  const selectedIds = new Set(itemIds);
  const selected = entities.filter((_entity, index) => selectedIds.has("ent-" + index));
  if (selected.length === 0) {
    throw new Error("Bitte mindestens eine Entität auswählen.");
  }

  const repo = createUweRepositoryFromClient(prisma);
  const campaign = await repo.getCampaignBySlug(context.worldSlug, context.campaignSlug);
  if (!campaign || campaign.id !== context.campaignId) {
    throw new Error("Die Zielkampagne gehört nicht mehr zur ausgewählten Welt.");
  }
  const existingPages = await repo.listPagesByWorld(context.worldSlug, {
    campaignId: context.campaignId,
  });
  const takenSlugs = new Set(existingPages.map((page) => page.slug));
  const createdPageIds: string[] = [];

  await importJobs().markExecuting(jobId);
  try {
    for (const entity of selected) {
      const slug = pickUniqueSlug(slugifyPageTitle(entity.title), takenSlugs);
      takenSlugs.add(slug);
      const page = await repo.createPage(
        entityToCreatePageInput(entity, {
          worldId: context.worldId,
          campaignId: context.campaignId,
          slug,
          importJobId: jobId,
          sourceFile: job.fileName || readPdfFileName(job.metadata) || "import.pdf",
        }),
      );
      createdPageIds.push(page.id);
    }

    const resultSummary = {
      created: createdPageIds.length,
      updated: 0,
      failed: 0,
      skipped: entities.length - createdPageIds.length,
      createdIds: createdPageIds,
      campaignId: context.campaignId,
    };
    const undoEntry = await createUndoService(brainPrisma, prisma).captureImportCentralExecute({
      targetType: "campaign",
      worldId: context.worldId,
      jobId,
      createdPageIds,
    });
    const undoToken = undoEntry?.id ?? null;
    await importJobs().markCompleted(jobId, resultSummary, undoToken);
    await deleteCampaignImportPdf(jobId);
    revalidatePath("/import");
    return { resultSummary, undoToken };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF-Kampagnenimport fehlgeschlagen.";
    await importJobs().markFailed(jobId, message);
    revalidatePath("/import");
    throw new Error(message);
  }
}
