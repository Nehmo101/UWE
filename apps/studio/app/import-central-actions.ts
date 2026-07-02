"use server";

import {
  createImportJobService,
  createUndoService,
  createUweRepository,
  executeMarkdownImport,
  extractObsidianVaultMarkdown,
  previewMarkdownImport,
  previewPdfImport,
  executePdfImport,
  prisma,
  type ImportSourceType,
  type ImportTargetType,
  type MarkdownImportExecuteResult,
  type MarkdownImportPreviewResult,
} from "@uwe/database/server";
import {
  importSourceRegistry,
  parseImportContent,
  previewFromContent,
  type ImportPreviewResult,
} from "@uwe/knoteforge-import";
import { revalidatePath } from "next/cache";
import { assertStudioTrusted } from "@/src/lib/authz";
import { getCurrentUser } from "@/src/lib/auth";
import {
  importCentralUsesWorldTarget,
  isImportCentralComboSupported,
  isImportCentralMarkdownTarget,
  importCentralSourceFormat,
} from "@/src/lib/import-central-utils";

const VALID_SOURCE_TYPES = new Set<ImportSourceType>([
  "knoteforge",
  "markdown",
  "obsidian",
  "pdf",
]);

const VALID_TARGET_TYPES = new Set<ImportTargetType>([
  "world",
  "personal_brain",
  "capture",
  "dnd_page",
]);

function importJobs() {
  return createImportJobService(prisma);
}

function revalidateImportCentral() {
  revalidatePath("/import");
}

async function requireImportJob(jobId: string) {
  const job = await importJobs().getJob(jobId);
  if (!job) {
    throw new Error("Import-Job nicht gefunden.");
  }
  return job;
}

function readWorldSlug(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const slug = (metadata as Record<string, unknown>).worldSlug;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
}

function markdownImportContext(job: {
  sourceType: ImportSourceType;
  targetType: ImportTargetType;
  fileName: string | null;
  targetWorldId: string | null;
  metadata: unknown;
}) {
  return {
    targetType: job.targetType,
    sourceType: job.sourceType,
    fileName: job.fileName,
    worldId: job.targetWorldId,
    worldSlug: readWorldSlug(job.metadata),
  };
}

/** Capture undo, mark the job completed, and build the shared result summary. */
async function finalizeImportCentralMarkdownExecute(
  jobId: string,
  job: { targetType: ImportTargetType; targetWorldId: string | null },
  result: MarkdownImportExecuteResult,
): Promise<{ resultSummary: Record<string, unknown>; undoToken: string | null }> {
  const resultSummary = {
    created: result.created,
    updated: result.updated,
    failed: result.failed,
    skipped: result.skipped,
    createdIds: result.createdIds,
  };

  const undo = createUndoService(prisma);
  const undoEntry = await undo.captureImportCentralExecute({
    targetType: job.targetType as "personal_brain" | "capture" | "dnd_page",
    worldId: job.targetWorldId,
    jobId,
    createdPersonalBrainDocumentIds:
      job.targetType === "personal_brain" ? result.createdIds : [],
    createdCaptureIds: job.targetType === "capture" ? result.createdIds : [],
    createdPageIds: job.targetType === "dnd_page" ? result.createdIds : [],
  });

  const undoToken = undoEntry?.id ?? null;
  await importJobs().markCompleted(jobId, resultSummary, undoToken);
  revalidateImportCentral();
  return { resultSummary, undoToken };
}

async function resolveWorldContext(targetWorldId: string | null) {
  if (!targetWorldId) {
    return { worldId: null, worldSlug: null };
  }

  const world = await prisma.world.findUnique({
    where: { id: targetWorldId },
    select: { id: true, slug: true },
  });

  if (!world) {
    throw new Error("Welt nicht gefunden.");
  }

  return { worldId: world.id, worldSlug: world.slug };
}

export async function createImportCentralJobAction(formData: FormData): Promise<{ jobId: string }> {
  assertStudioTrusted();

  const sourceTypeRaw = String(formData.get("sourceType") || "").trim();
  const targetTypeRaw = String(formData.get("targetType") || "").trim();
  const targetWorldId = String(formData.get("targetWorldId") || "").trim() || null;
  const fileName = String(formData.get("fileName") || "").trim() || null;

  if (!VALID_SOURCE_TYPES.has(sourceTypeRaw as ImportSourceType)) {
    throw new Error("Ungültiger Quelltyp.");
  }
  if (!VALID_TARGET_TYPES.has(targetTypeRaw as ImportTargetType)) {
    throw new Error("Ungültiges Import-Ziel.");
  }

  const sourceType = sourceTypeRaw as ImportSourceType;
  const targetType = targetTypeRaw as ImportTargetType;

  if (!isImportCentralComboSupported(sourceType, targetType)) {
    throw new Error("Diese Import-Kombination ist noch nicht verfügbar.");
  }

  const needsWorld = importCentralUsesWorldTarget(targetType);
  if (needsWorld && !targetWorldId) {
    throw new Error("Bitte eine Welt auswählen.");
  }

  let worldSlug: string | null = null;
  if (targetWorldId) {
    const world = await resolveWorldContext(targetWorldId);
    worldSlug = world.worldSlug;
  }

  const user = await getCurrentUser();
  const job = await importJobs().createJob({
    sourceType,
    targetType,
    targetWorldId,
    fileName,
    createdByUserId: user?.id ?? null,
    metadata: worldSlug ? { worldSlug } : null,
  });

  revalidateImportCentral();
  return { jobId: job.id };
}

export async function previewImportCentralJobAction(
  jobId: string,
  content: string,
): Promise<{ preview: ImportPreviewResult | MarkdownImportPreviewResult }> {
  assertStudioTrusted();

  const job = await requireImportJob(jobId);
  if (!isImportCentralComboSupported(job.sourceType, job.targetType)) {
    throw new Error("Vorschau für diese Kombination ist noch nicht verfügbar.");
  }

  if (job.sourceType === "pdf") {
    throw new Error("PDF-Vorschau bitte über previewImportCentralPdfJobAction.");
  }

  if (content.length > 10 * 1024 * 1024) {
    throw new Error("Import-Datei ist zu groß (max. 10 MB).");
  }

  if (isImportCentralMarkdownTarget(job.targetType)) {
    const preview = previewMarkdownImport(content, markdownImportContext(job));

    await importJobs().updateJob(jobId, {
      status: "preview",
      previewPayload: preview as unknown as Record<string, unknown>,
    });

    revalidateImportCentral();
    return { preview };
  }

  const format = importCentralSourceFormat(job.sourceType);
  if (!format) {
    throw new Error("Quelltyp unterstützt keine Vorschau.");
  }

  const worldSlug = readWorldSlug(job.metadata);
  if (!worldSlug) {
    throw new Error("Welt-Kontext fehlt für diesen Import-Job.");
  }

  if (!importSourceRegistry.supportedFormats().includes(format)) {
    throw new Error(`Format „${format}" ist noch nicht verfügbar.`);
  }

  try {
    parseImportContent(format, content);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Import-Datei konnte nicht gelesen werden.",
    );
  }

  const repo = createUweRepository();
  const preview = await previewFromContent(repo, format, content, worldSlug);

  await importJobs().updateJob(jobId, {
    status: "preview",
    previewPayload: preview as unknown as Record<string, unknown>,
  });

  revalidateImportCentral();
  return { preview };
}

export async function executeImportCentralJobAction(
  jobId: string,
  content: string,
  itemIds?: string[],
): Promise<{ resultSummary: Record<string, unknown>; undoToken: string | null }> {
  assertStudioTrusted();

  const job = await requireImportJob(jobId);
  if (!isImportCentralComboSupported(job.sourceType, job.targetType)) {
    throw new Error("Import für diese Kombination ist noch nicht verfügbar.");
  }

  if (!isImportCentralMarkdownTarget(job.targetType)) {
    throw new Error("Dieser Import-Job wird über den Welt-Import ausgeführt.");
  }

  if (job.sourceType === "pdf") {
    throw new Error("PDF-Import bitte über die PDF-Aktion ausführen.");
  }

  if (content.length > 10 * 1024 * 1024) {
    throw new Error("Import-Datei ist zu groß (max. 10 MB).");
  }

  await importJobs().markExecuting(jobId);

  try {
    const result = await executeMarkdownImport(prisma, content, markdownImportContext(job), {
      itemIds,
    });
    return await finalizeImportCentralMarkdownExecute(jobId, job, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import fehlgeschlagen.";
    await importJobs().markFailed(jobId, message);
    revalidateImportCentral();
    throw new Error(message);
  }
}

export async function previewImportCentralPdfJobAction(
  jobId: string,
  contentBase64: string,
): Promise<{ preview: MarkdownImportPreviewResult }> {
  assertStudioTrusted();

  const job = await requireImportJob(jobId);
  if (job.sourceType !== "pdf" || !isImportCentralMarkdownTarget(job.targetType)) {
    throw new Error("Vorschau für diese PDF-Kombination ist nicht verfügbar.");
  }

  const buffer = Buffer.from(contentBase64, "base64");
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("PDF-Datei ist zu groß (max. 10 MB).");
  }

  const preview = await previewPdfImport(buffer, markdownImportContext(job));

  await importJobs().updateJob(jobId, {
    status: "preview",
    previewPayload: preview as unknown as Record<string, unknown>,
  });

  revalidateImportCentral();
  return { preview };
}

export async function executeImportCentralPdfJobAction(
  jobId: string,
  contentBase64: string,
  itemIds?: string[],
): Promise<{ resultSummary: Record<string, unknown>; undoToken: string | null }> {
  assertStudioTrusted();

  const job = await requireImportJob(jobId);
  if (job.sourceType !== "pdf" || !isImportCentralMarkdownTarget(job.targetType)) {
    throw new Error("Import für diese PDF-Kombination ist nicht verfügbar.");
  }

  const buffer = Buffer.from(contentBase64, "base64");
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("PDF-Datei ist zu groß (max. 10 MB).");
  }

  await importJobs().markExecuting(jobId);

  try {
    const result = await executePdfImport(prisma, buffer, markdownImportContext(job), {
      itemIds,
    });
    return await finalizeImportCentralMarkdownExecute(jobId, job, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF-Import fehlgeschlagen.";
    await importJobs().markFailed(jobId, message);
    revalidateImportCentral();
    throw new Error(message);
  }
}

export interface ObsidianVaultPreviewResponse {
  preview: MarkdownImportPreviewResult;
  vaultFileCount: number;
  vaultFiles: string[];
}

export async function previewImportCentralObsidianVaultAction(
  jobId: string,
  contentBase64: string,
): Promise<ObsidianVaultPreviewResponse> {
  assertStudioTrusted();

  const job = await requireImportJob(jobId);
  if (job.sourceType !== "obsidian" || !isImportCentralMarkdownTarget(job.targetType)) {
    throw new Error(
      "Vault-ZIP-Import ist nur für die Ziele Life Brain, Capture oder DnD-Seite verfügbar.",
    );
  }

  const buffer = Buffer.from(contentBase64, "base64");
  const vault = extractObsidianVaultMarkdown(buffer);
  const preview = previewMarkdownImport(vault.markdown, markdownImportContext(job));

  await importJobs().updateJob(jobId, {
    status: "preview",
    previewPayload: preview as unknown as Record<string, unknown>,
  });

  revalidateImportCentral();
  return { preview, vaultFileCount: vault.fileCount, vaultFiles: vault.files };
}

export async function executeImportCentralObsidianVaultAction(
  jobId: string,
  contentBase64: string,
  itemIds?: string[],
): Promise<{ resultSummary: Record<string, unknown>; undoToken: string | null }> {
  assertStudioTrusted();

  const job = await requireImportJob(jobId);
  if (job.sourceType !== "obsidian" || !isImportCentralMarkdownTarget(job.targetType)) {
    throw new Error(
      "Vault-ZIP-Import ist nur für die Ziele Life Brain, Capture oder DnD-Seite verfügbar.",
    );
  }

  const buffer = Buffer.from(contentBase64, "base64");
  const vault = extractObsidianVaultMarkdown(buffer);

  await importJobs().markExecuting(jobId);

  try {
    const result = await executeMarkdownImport(prisma, vault.markdown, markdownImportContext(job), {
      itemIds,
    });
    return await finalizeImportCentralMarkdownExecute(jobId, job, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vault-Import fehlgeschlagen.";
    await importJobs().markFailed(jobId, message);
    revalidateImportCentral();
    throw new Error(message);
  }
}

export async function markImportCentralExecutingAction(jobId: string): Promise<void> {
  assertStudioTrusted();
  await requireImportJob(jobId);
  await importJobs().markExecuting(jobId);
  revalidateImportCentral();
}

export async function completeImportCentralJobAction(
  jobId: string,
  resultSummary: Record<string, unknown>,
  undoToken?: string | null,
): Promise<void> {
  assertStudioTrusted();
  await requireImportJob(jobId);
  await importJobs().markCompleted(jobId, resultSummary, undoToken ?? null);
  revalidateImportCentral();
}

export async function failImportCentralJobAction(jobId: string, errorMessage: string): Promise<void> {
  assertStudioTrusted();
  await requireImportJob(jobId);
  await importJobs().markFailed(jobId, errorMessage);
  revalidateImportCentral();
}

export async function rollbackImportCentralJobAction(jobId: string): Promise<void> {
  assertStudioTrusted();
  const job = await requireImportJob(jobId);
  if (job.status !== "completed") {
    throw new Error("Nur abgeschlossene Import-Jobs können zurückgerollt werden.");
  }
  if (!job.undoToken) {
    throw new Error("Für diesen Import ist kein Undo-Token hinterlegt.");
  }

  const undo = createUndoService(prisma);
  const result = await undo.undo(job.undoToken);
  if (!result.ok) {
    throw new Error(result.message);
  }

  await importJobs().markRolledBack(jobId);
  revalidateImportCentral();
}
