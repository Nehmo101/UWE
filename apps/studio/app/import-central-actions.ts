"use server";

import {
  createImportJobService,
  createUweRepository,
  prisma,
  type ImportSourceType,
  type ImportTargetType,
} from "@uwe/database/server";
import {
  importSourceRegistry,
  parseImportContent,
  previewFromContent,
  type ImportFormat,
  type ImportPreviewResult,
} from "@uwe/knoteforge-import";
import { revalidatePath } from "next/cache";
import { assertStudioTrusted } from "@/src/lib/authz";
import { getCurrentUser } from "@/src/lib/auth";
import { isImportCentralComboSupported } from "@/src/lib/import-central-utils";

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

function sourceTypeToFormat(sourceType: ImportSourceType): ImportFormat | null {
  switch (sourceType) {
    case "knoteforge":
      return "json";
    case "markdown":
      return "markdown";
    default:
      return null;
  }
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

  const needsWorld = targetType === "world" || targetType === "dnd_page";
  if (needsWorld && !targetWorldId) {
    throw new Error("Bitte eine Welt auswählen.");
  }

  let worldSlug: string | null = null;
  if (targetWorldId) {
    const world = await prisma.world.findUnique({
      where: { id: targetWorldId },
      select: { id: true, slug: true },
    });
    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }
    worldSlug = world.slug;
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
): Promise<{ preview: ImportPreviewResult }> {
  assertStudioTrusted();

  const job = await requireImportJob(jobId);
  if (!isImportCentralComboSupported(job.sourceType, job.targetType)) {
    throw new Error("Vorschau für diese Kombination ist noch nicht verfügbar.");
  }

  const format = sourceTypeToFormat(job.sourceType);
  if (!format) {
    throw new Error("Quelltyp unterstützt keine Vorschau.");
  }

  const worldSlug = readWorldSlug(job.metadata);
  if (!worldSlug) {
    throw new Error("Welt-Kontext fehlt für diesen Import-Job.");
  }

  if (content.length > 10 * 1024 * 1024) {
    throw new Error("Import-Datei ist zu groß (max. 10 MB).");
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
  await importJobs().markRolledBack(jobId);
  revalidateImportCentral();
}
