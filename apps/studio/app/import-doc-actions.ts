"use server";

import { revalidatePath } from "next/cache";
import {
  createImportJobService,
  createUndoService,
  createUweRepositoryFromClient,
  prisma,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { extractObsidianVaultFiles } from "@uwe/database/obsidian-vault";
import {
  buildDocImportPlan,
  buildDocImportPreview,
  type DocImportPreview,
  type DocImportSourceFile,
} from "@uwe/doc-import";
import { writeDocImport } from "@uwe/doc-import/writer";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  docImportSettingsFromMetadata,
  parseDocImportSettings,
  type DocImportSettings,
} from "@/src/lib/doc-import-settings";

/**
 * Dokument- und Bulk-Wiki-Import.
 *
 * Vorschau und Ausführung erzeugen den Plan **beide** aus demselben Text. Das
 * geht, weil der Weg von Markdown zu Seitenentwürfen vollständig deterministisch
 * ist — keine KI, kein Zufall, keine Uhr. Der Job speichert deshalb nur die
 * schlanke Vorschau, nicht das fertige HTML aller Seiten; ein Kampagnenbuch mit
 * 176 Seiten muss nicht doppelt in der Datenbank liegen.
 */

const MAX_CONTENT_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 2000;

function importJobs() {
  return createImportJobService(prisma);
}

function revalidateImportCentral() {
  revalidatePath("/import");
}

async function requireDocImportJob(jobId: string) {
  const job = await importJobs().getJob(jobId);
  if (!job) {
    throw new Error("Import-Job nicht gefunden.");
  }
  if (job.targetType !== "world") {
    throw new Error("Dieser Job ist kein Dokument-Import.");
  }
  if (!job.targetWorldId) {
    throw new Error("Welt-Kontext fehlt für diesen Import-Job.");
  }
  return job;
}

function assertFilesWithinLimits(files: DocImportSourceFile[]): void {
  if (files.length === 0) {
    throw new Error("Keine Datei ausgewählt.");
  }
  if (files.length > MAX_FILES) {
    throw new Error(`Zu viele Dateien (max. ${MAX_FILES}).`);
  }

  const total = files.reduce((sum, file) => sum + file.content.length, 0);
  if (total > MAX_CONTENT_BYTES) {
    throw new Error("Die Auswahl ist zu groß (max. 10 MB Text).");
  }
}

async function loadWorldContext(worldId: string) {
  const world = await prisma.world.findUnique({
    where: { id: worldId },
    select: { id: true, name: true, slug: true },
  });
  if (!world) {
    throw new Error("Welt nicht gefunden.");
  }
  return world;
}

async function buildPlanForJob(
  worldSlug: string,
  worldName: string,
  files: DocImportSourceFile[],
  settings: DocImportSettings,
) {
  const repo = createUweRepositoryFromClient(prisma);
  const existingPages = await repo.listPagesByWorld(worldSlug);
  const campaigns = await repo.listCampaignsByWorld(worldSlug);

  const plan = buildDocImportPlan(files, {
    mode: settings.mode,
    profile: settings.profile,
    maxDepth: settings.maxDepth,
    existingSlugs: existingPages.map((page) => page.slug),
    worldName,
    worldSlug,
  });

  return { plan, existingPages, campaigns };
}

/**
 * Entpackt einen Obsidian-Vault-Export in Einzeldateien.
 *
 * Bewusst dateiweise und nicht als Bündel: beim Bulk-Wiki ist eine Datei genau
 * eine Seite, und ohne Dateigrenzen wäre das nicht mehr entscheidbar.
 */
export async function extractDocImportVaultAction(
  zipBase64: string,
): Promise<{ files: DocImportSourceFile[] }> {
  await requireStudioActionAuth();

  const buffer = Buffer.from(zipBase64, "base64");
  const files = extractObsidianVaultFiles(buffer);

  return { files: files.map((file) => ({ fileName: file.fileName, content: file.content })) };
}

export async function previewImportDocJobAction(
  jobId: string,
  files: DocImportSourceFile[],
  rawSettings: unknown,
): Promise<{ preview: DocImportPreview; perFile: Array<{ fileName: string; pageCount: number }> }> {
  await requireStudioActionAuth();

  const job = await requireDocImportJob(jobId);
  assertFilesWithinLimits(files);

  const settings = parseDocImportSettings(rawSettings);
  const world = await loadWorldContext(job.targetWorldId!);

  const { plan, existingPages, campaigns } = await buildPlanForJob(
    world.slug,
    world.name,
    files,
    settings,
  );

  const preview = buildDocImportPreview(plan.pages, plan.relations, {
    existingPages: existingPages.map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      aliases: Array.isArray(page.aliases) ? (page.aliases as string[]) : [],
    })),
    campaignNames: campaigns.flatMap((campaign) => [campaign.name, campaign.slug]),
    warnings: plan.warnings,
  });

  await importJobs().updateJob(jobId, {
    status: "preview",
    previewPayload: {
      items: preview.items,
      summary: preview.summary,
      warnings: preview.warnings,
      unknownCampaigns: preview.unknownCampaigns,
      unresolvedLinks: preview.unresolvedLinks.slice(0, 200),
      perFile: plan.perFile,
    } as unknown as Record<string, unknown>,
    // Die bestätigten Einstellungen wandern in den Job, damit die Ausführung
    // exakt das erzeugt, was in der Vorschau stand.
    metadata: {
      ...(job.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata)
        ? (job.metadata as Record<string, unknown>)
        : {}),
      docImport: { ...settings },
    } as unknown as Record<string, unknown>,
  });

  revalidateImportCentral();
  return { preview, perFile: plan.perFile };
}

export async function executeImportDocJobAction(
  jobId: string,
  files: DocImportSourceFile[],
  keys?: string[],
): Promise<{ resultSummary: Record<string, unknown>; undoToken: string | null }> {
  await requireStudioActionAuth();

  const job = await requireDocImportJob(jobId);
  assertFilesWithinLimits(files);

  const settings = docImportSettingsFromMetadata(job.metadata);
  const world = await loadWorldContext(job.targetWorldId!);

  await importJobs().markExecuting(jobId);

  try {
    const { plan } = await buildPlanForJob(world.slug, world.name, files, settings);
    const repo = createUweRepositoryFromClient(prisma);

    const result = await writeDocImport(repo, plan.pages, plan.relations, {
      worldSlug: world.slug,
      confirmed: true,
      keys: keys && keys.length > 0 ? keys : undefined,
    });

    const resultSummary = {
      created: result.created,
      failed: result.failed,
      linksCreated: result.linksCreated,
      warnings: result.warnings,
    };

    // PageLinks hängen per Cascade an ihrer Quellseite — das Löschen der
    // erzeugten Seiten räumt sie mit ab, ein eigener Rückbau ist nicht nötig.
    const undoEntry = await createUndoService(brainPrisma, prisma).captureImportExecute({
      worldId: world.id,
      jobId,
      createdPageIds: result.undo.createdPageIds,
      updatedPages: [],
    });

    const undoToken = undoEntry?.id ?? null;
    await importJobs().markCompleted(jobId, resultSummary, undoToken);
    revalidateImportCentral();
    revalidatePath(`/worlds/${world.slug}/wiki`);

    return { resultSummary, undoToken };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import fehlgeschlagen.";
    await importJobs().markFailed(jobId, message);
    revalidateImportCentral();
    throw new Error(message);
  }
}
