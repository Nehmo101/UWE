"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { AiRouterError, routeAiRequest } from "@uwe/ai-brain";
import {
  createImportJobService,
  createUndoService,
  createUweRepository,
  extractPdfText,
  pickUniqueSlug,
  prisma,
  slugifyPageTitle,
} from "@uwe/database/server";
import {
  buildCampaignExtractionPrompt,
  buildCampaignPreview,
  chunkPdfText,
  dedupeEntitiesByTitle,
  entityToCreatePageInput,
  MAX_CHUNKS,
  parseCampaignEntities,
  type CampaignImportPreview,
  type ExtractedCampaignEntity,
} from "@uwe/pdf-campaign-import";
import { revalidatePath } from "next/cache";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const CAMPAIGN_PREVIEW_KIND = "campaign_entities";

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

function recordFrom(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readCampaignMetadata(
  metadata: unknown,
  targetWorldId: string | null,
): { worldId: string; worldSlug: string; campaignId: string; campaignSlug: string } {
  const record = recordFrom(metadata);
  const worldSlug = record ? readString(record, "worldSlug") : null;
  const campaignId = record ? readString(record, "campaignId") : null;
  const campaignSlug = record ? readString(record, "campaignSlug") : null;
  if (!targetWorldId || !worldSlug || !campaignId || !campaignSlug) {
    throw new Error("Kampagnen-Kontext fehlt im Import-Job.");
  }
  return { worldId: targetWorldId, worldSlug, campaignId, campaignSlug };
}

function readPreviewEntities(previewPayload: unknown): ExtractedCampaignEntity[] | null {
  const record = recordFrom(previewPayload);
  if (record?.kind !== CAMPAIGN_PREVIEW_KIND || !Array.isArray(record.entities)) {
    return null;
  }
  return parseCampaignEntities(JSON.stringify(record.entities));
}

function readStoredPreview(previewPayload: unknown): CampaignImportPreview | null {
  const record = recordFrom(previewPayload);
  const entities = readPreviewEntities(previewPayload);
  if (!record || !entities) {
    return null;
  }
  const preview = buildCampaignPreview(entities);
  const errors = Array.isArray(record.errors)
    ? record.errors.filter((error): error is string => typeof error === "string")
    : [];
  return {
    ...preview,
    errors,
    canExecute: preview.canExecute && record.canExecute !== false,
  };
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

function buildPreviewPayload(
  preview: CampaignImportPreview,
  extractionMeta: Record<string, unknown>,
): Record<string, unknown> {
  return {
    kind: CAMPAIGN_PREVIEW_KIND,
    ...preview,
    extractionMeta,
  };
}

async function markPreviewFailed(
  jobId: string,
  message: string,
): Promise<{ preview: CampaignImportPreview }> {
  const preview = {
    ...buildCampaignPreview([]),
    errors: [message],
    canExecute: false,
  };
  await importJobs().updateJob(jobId, {
    previewPayload: buildPreviewPayload(preview, { aiRoute: "local_rtx" }),
  });
  await importJobs().markFailed(jobId, message);
  revalidatePath("/import");
  return { preview };
}

export async function previewImportCampaignPdfJobAction(
  jobId: string,
  contentBase64: string,
): Promise<{ preview: CampaignImportPreview }> {
  await requireStudioActionAuth();

  const job = await requireCampaignPdfJob(jobId);
  const storedPreview = readStoredPreview(job.previewPayload);
  if (storedPreview) {
    return { preview: storedPreview };
  }

  const buffer = Buffer.from(contentBase64, "base64");
  if (buffer.length > MAX_PDF_BYTES) {
    return markPreviewFailed(jobId, "PDF-Datei ist zu groß (max. 10 MB).");
  }

  try {
    const text = await extractPdfText(buffer);
    const chunks = chunkPdfText(text);
    const useMock = process.env.NODE_ENV !== "production" && process.env.AI_USE_MOCK === "true";
    const repo = createUweRepository();
    const extracted: ExtractedCampaignEntity[] = [];

    for (const [index, chunk] of chunks.entries()) {
      const routed = await routeAiRequest(
        { repo, prisma },
        {
          providerMode: "local_rtx",
          contextMode: "general_chat",
          taskType: "create_knowledge_text",
          userPrompt: buildCampaignExtractionPrompt(chunk),
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
    }

    const entities = dedupeEntitiesByTitle(extracted);
    const basePreview = buildCampaignPreview(entities);
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
      chunkCount: chunks.length,
      maxChunks: MAX_CHUNKS,
      sourceCharacters: text.length,
      processedCharacters,
      truncated: chunks.length === MAX_CHUNKS && processedCharacters < text.trim().length,
      useMock,
    };

    await importJobs().updateJob(jobId, {
      status: "preview",
      previewPayload: buildPreviewPayload(preview, extractionMeta),
      errorMessage: null,
    });
    revalidatePath("/import");
    return { preview };
  } catch (error) {
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

  const repo = createUweRepository();
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
          sourceFile: job.fileName || "import.pdf",
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
    const undoEntry = await createUndoService(prisma).captureImportCentralExecute({
      targetType: "campaign",
      worldId: context.worldId,
      jobId,
      createdPageIds,
    });
    const undoToken = undoEntry?.id ?? null;
    await importJobs().markCompleted(jobId, resultSummary, undoToken);
    revalidatePath("/import");
    return { resultSummary, undoToken };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF-Kampagnenimport fehlgeschlagen.";
    await importJobs().markFailed(jobId, message);
    revalidatePath("/import");
    throw new Error(message);
  }
}
