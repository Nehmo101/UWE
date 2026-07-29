"use server";

import {
  requireStudioActionAuth,
  requireStudioAiActionAuth,
} from "@/src/lib/studio-action-auth";
import {
  createImportJobService,
  createUndoService,
  createUweRepositoryFromClient,
  pickUniqueSlug,
  prisma,
  slugifyPageTitle,
} from "@uwe/database/server";
import { enqueueAndDispatch } from "@/src/lib/job-executor";
import {
  CAMPAIGN_PDF_ANALYSIS_KIND,
  type CampaignPdfAnalysisPayload,
} from "@/src/lib/campaign-import-job";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  entityToCreatePageInput,
  MAX_CAMPAIGN_CONTEXT_CHARACTERS,
  MAX_CAMPAIGN_PDF_BYTES,
  toCampaignPreviewSummary,
  type CampaignImportPreviewSummary,
} from "@uwe/pdf-campaign-import";
import {
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
  deleteCampaignImportFigures,
  deleteCampaignImportPdf,
  hasCampaignImportPdf,
} from "@/src/lib/campaign-pdf-storage";
import {
  attachCampaignFigures,
  readCampaignFigures,
  type CreatedCampaignPage,
} from "@/src/lib/campaign-figure-assets";
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

async function writeProgress(jobId: string, progress: CampaignAnalysisProgress): Promise<void> {
  await importJobs().updateJob(jobId, { previewPayload: buildProgressPayload(progress) });
}

/** Poll-Endpunkt für das Panel: Upload-/Analyse-/Vorschau-Zustand des Jobs. */
export async function getImportCampaignJobStatusAction(
  jobId: string,
): Promise<CampaignPdfJobStatus> {
  await requireStudioActionAuth();
  const job = await requireCampaignPdfJob(jobId);
  return jobToCampaignStatus(job, await hasCampaignImportPdf(jobId));
}

/**
 * Startet die Analyse. Sie läuft als Hintergrund-`Job` (siehe
 * `campaign-import-job.ts`) — ein Abenteuerband mit OCR dauert zu lange für
 * eine Server Action. Liegt bereits eine Vorschau vor, kommt sie sofort
 * zurück; sonst meldet die Antwort nur, dass der Lauf gestartet ist, und das
 * Panel verfolgt den Fortschritt über `getImportCampaignJobStatusAction`.
 */
export async function previewImportCampaignPdfJobAction(
  jobId: string,
  campaignContext = "",
): Promise<{ preview: CampaignImportPreviewSummary | null; started: boolean }> {
  // KI-Guard, obwohl die Analyse inzwischen als Hintergrund-Job läuft: der
  // Klick hier ist es, der den RTX-Host beschäftigt — dass die Arbeit
  // asynchron passiert, ändert nichts daran, wer sie ausgelöst hat.
  await requireStudioAiActionAuth();

  const job = await requireCampaignPdfJob(jobId);
  const storedPreview = readStoredPreview(job.previewPayload);
  if (storedPreview && storedPreview.totalDocuments > 0) {
    return { preview: toCampaignPreviewSummary(storedPreview), started: false };
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

  if (!(await hasCampaignImportPdf(jobId))) {
    throw new Error("Keine hochgeladene PDF gefunden — bitte zuerst die PDF-Datei hochladen.");
  }

  // Sichtbarer Startzustand, bevor der Runner das erste Mal schreibt — sonst
  // sähe das Panel zwischen Klick und erstem Fortschritt einen leeren Job.
  await writeProgress(jobId, {
    phase: "extracting",
    processedChunks: 0,
    totalChunks: null,
    startedAt: new Date().toISOString(),
  });

  await enqueueAndDispatch({
    type: "import",
    title: `PDF-Kampagnenanalyse: ${job.fileName || readPdfFileName(job.metadata) || "import.pdf"}`,
    ...(job.targetWorldId ? { worldId: job.targetWorldId } : {}),
    payload: {
      kind: CAMPAIGN_PDF_ANALYSIS_KIND,
      importJobId: jobId,
      campaignContext: normalizedCampaignContext,
      worldId: job.targetWorldId ?? null,
      maxBytes: MAX_CAMPAIGN_PDF_BYTES,
    } satisfies CampaignPdfAnalysisPayload,
  });

  revalidatePath("/import");
  return { preview: null, started: true };
}

export async function executeImportCampaignPdfJobAction(
  jobId: string,
  itemIds: string[],
): Promise<{ resultSummary: Record<string, unknown>; undoToken: string | null }> {
  await requireStudioAiActionAuth();

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

  const sourceFile = job.fileName || readPdfFileName(job.metadata) || "import.pdf";
  const createdPages: CreatedCampaignPage[] = [];

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
          sourceFile,
        }),
      );
      createdPageIds.push(page.id);
      createdPages.push({
        pageId: page.id,
        title: entity.title,
        sourcePages: entity.sourcePages ?? [],
      });
    }

    // Karten und Abbildungen der zugehörigen PDF-Seiten anhängen. Scheitert das,
    // scheitert der ganze Execute — die erzeugten Seiten hängen am selben
    // Undo-Eintrag und würden sonst halb bebildert zurückbleiben.
    const figureResult = await attachCampaignFigures(repo, {
      jobId,
      worldId: context.worldId,
      campaignId: context.campaignId,
      sourceFile,
      figures: readCampaignFigures(job.previewPayload),
      pages: createdPages,
    });

    const resultSummary = {
      created: createdPageIds.length,
      updated: 0,
      failed: 0,
      skipped: entities.length - createdPageIds.length,
      createdIds: createdPageIds,
      campaignId: context.campaignId,
      createdAssets: figureResult.createdAssetIds.length,
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
    await deleteCampaignImportFigures(jobId);
    revalidatePath("/import");
    return { resultSummary, undoToken };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF-Kampagnenimport fehlgeschlagen.";
    await importJobs().markFailed(jobId, message);
    revalidatePath("/import");
    throw new Error(message);
  }
}
