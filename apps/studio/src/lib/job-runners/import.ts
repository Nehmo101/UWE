import {
  createActivityLogService,
  createUndoService,
  createUweRepository,
  logAuditEvent,
  prisma,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  executeImport,
  parseImportContent,
  type ImportExecuteOptions,
  type ImportFormat,
} from "@uwe/knoteforge-import";
import {
  isCampaignPdfAnalysisPayload,
  runCampaignPdfAnalysisJob,
} from "../campaign-import-job";
import { assertNotCancelled, type JobRunnerContext } from "./context";

export async function runImportJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  // PDF→Kampagne teilt sich den Job-Typ, bringt aber eine eigene Payload mit
  // und eine eigene Ausführung (OCR + Chunk-Analyse) — siehe campaign-import-job.ts.
  if (isCampaignPdfAnalysisPayload(ctx.job.payload)) {
    return runCampaignPdfAnalysisJob(ctx);
  }

  const payload = (ctx.job.payload ?? {}) as ImportJobPayload;
  if (!payload.format || !payload.content || !payload.worldSlug) {
    throw new Error("Import-Payload unvollständig.");
  }

  await ctx.jobs.updateProgress(ctx.jobId, 15, "Import-Datei lesen");
  const repo = createUweRepository();
  const { bundle } = parseImportContent(payload.format, payload.content);

  const options: ImportExecuteOptions = {
    confirmed: true,
    itemIds: payload.itemIds,
    autoResolveSlugConflicts: payload.autoResolveSlugConflicts ?? true,
    allowUpdates: payload.allowUpdates ?? true,
  };

  await ctx.jobs.updateProgress(ctx.jobId, 50, "Daten importieren");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const result = await executeImport(repo, bundle, payload.worldSlug, payload.format, options);
  const world = await repo.getWorldBySlug(payload.worldSlug);

  let undoEntryId: string | undefined;
  if (result.undo && world && (result.undo.createdPageIds.length > 0 || result.undo.updatedPages.length > 0)) {
    const undoService = createUndoService(brainPrisma, prisma);
    const undoEntry = await undoService.captureImportExecute({
      worldId: world.id,
      jobId: ctx.jobId,
      createdPageIds: result.undo.createdPageIds,
      updatedPages: result.undo.updatedPages as import("@uwe/database/server").ImportPageUpdateSnapshot[],
    });
    undoEntryId = undoEntry.id;
  }

  await createActivityLogService(prisma).log({
    worldSlug: payload.worldSlug,
    action: "import_executed",
    targetType: "world",
    targetLabel: payload.worldSlug,
    targetHref: `/worlds/${payload.worldSlug}`,
    summary: `Import (${payload.format}) in Welt „${payload.worldSlug}" ausgeführt.`,
    undoEntryId,
  });

  await logAuditEvent(prisma, {
    action: "import_completed",
    targetType: "import",
    targetId: ctx.jobId,
    worldId: world?.id,
    metadata: { format: payload.format, jobId: ctx.jobId },
  });

  return { result, undoEntryId: undoEntryId ?? null };
}

interface ImportJobPayload {
  format: ImportFormat;
  content: string;
  worldSlug: string;
  itemIds?: string[];
  autoResolveSlugConflicts?: boolean;
  allowUpdates?: boolean;
}
