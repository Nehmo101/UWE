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
import { PageTypeEnum, type PageType } from "@uwe/database/enums";
import {
  buildDocImportPlan,
  buildDocImportPreview,
  type DocImportPreview,
  type DocImportSourceFile,
  type DocImportStructure,
  type KnownEntity,
  type SectionRole,
} from "@uwe/doc-import";
import { collectRoleHints } from "@uwe/doc-import/ai";
import { writeDocImport } from "@uwe/doc-import/writer";
import { requireStudioActionAuth, requireStudioAiActionAuth } from "@/src/lib/studio-action-auth";
import {
  docImportSettingsFromMetadata,
  parseDocImportSettings,
  roleHintsFromMetadata,
  serializeRoleHints,
  type DocImportSettings,
} from "@/src/lib/doc-import-settings";

/**
 * Dokument- und Bulk-Wiki-Import.
 *
 * Vorschau und Ausführung erzeugen den Plan **beide** aus demselben Text. Das
 * geht, weil der Weg von Markdown zu Seitenentwürfen vollständig deterministisch
 * ist — kein Zufall, keine Uhr. Der Job speichert deshalb nur die schlanke
 * Vorschau, nicht das fertige HTML aller Seiten; ein Kampagnenbuch mit 176
 * Seiten muss nicht doppelt in der Datenbank liegen.
 *
 * Die eine Ausnahme ist der **KI-Feinschliff**: Der Maschinenraum-Host ist kein
 * deterministischer Teil des Systems. Sein Urteil wird deshalb einmal in der
 * Vorschau eingeholt, im Job abgelegt und beim Ausführen von dort gelesen —
 * angelegt wird genau das, was bestätigt wurde, auch wenn der Host inzwischen
 * schweigt oder anders antworten würde.
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

/**
 * Was die Welt schon kennt, in der Form, die der Import versteht.
 *
 * Direkt aus dem Repository — der Import sitzt auf derselben Maschine wie die
 * Datenbank. Ein Umweg über den Studio-MCP wäre HTTP auf die eigene Instanz und
 * hieße, dass der Import nur läuft, solange Studio läuft.
 */
function toKnownEntities(pages: Array<{ title: string; type: string; aliases: unknown }>): KnownEntity[] {
  return pages.map((page) => ({
    title: page.title,
    type: page.type as KnownEntity["type"],
    aliases: Array.isArray(page.aliases) ? (page.aliases as string[]) : [],
  }));
}

async function buildPlanForJob(
  worldSlug: string,
  worldName: string,
  files: DocImportSourceFile[],
  settings: DocImportSettings,
  roleHints: Map<string, Map<string, SectionRole>>,
) {
  const repo = createUweRepositoryFromClient(prisma);
  const existingPages = await repo.listPagesByWorld(worldSlug);
  const campaigns = await repo.listCampaignsByWorld(worldSlug);

  const plan = buildDocImportPlan(files, {
    mode: settings.mode,
    profile: settings.profile,
    existingSlugs: existingPages.map((page) => page.slug),
    worldName,
    worldSlug,
    roleHints,
    knownEntities: toKnownEntities(existingPages),
  });

  return { plan, existingPages, campaigns };
}

/**
 * Holt den KI-Feinschliff — oder gibt auf und sagt es.
 *
 * `requireStudioAiActionAuth` steht hier und nicht am Anfang der Action, weil
 * der Import auch ohne KI-Berechtigung vollständig funktioniert. Wer den Maschinenraum
 * nicht benutzen darf, bekommt die Regelzuordnung; niemand steht vor einer
 * verschlossenen Tür, nur weil ein Häkchen fehlt.
 */
async function resolveRoleHints(
  files: DocImportSourceFile[],
  settings: DocImportSettings,
  world: { slug: string; name: string },
): Promise<{ hints: Map<string, Map<string, SectionRole>>; warnings: string[] }> {
  if (!settings.useAi || settings.mode !== "document") {
    return { hints: new Map(), warnings: [] };
  }

  try {
    await requireStudioAiActionAuth();
  } catch {
    return {
      hints: new Map(),
      warnings: ["Dieses Konto darf die lokale KI nicht nutzen — die Zuordnung läuft über die Regeln."],
    };
  }

  const repo = createUweRepositoryFromClient(prisma);
  const collected = await collectRoleHints(
    { repo, prisma },
    {
      profile: settings.profile,
      files,
      knownEntities: toKnownEntities(await repo.listPagesByWorld(world.slug)),
      worldName: world.name,
      useMock: process.env.NODE_ENV !== "production" && process.env.AI_USE_MOCK === "true",
    },
  );

  return { hints: collected.hints, warnings: collected.warnings };
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
): Promise<{
  preview: DocImportPreview;
  perFile: Array<{ fileName: string; pageCount: number }>;
  structure: DocImportStructure;
}> {
  await requireStudioActionAuth();

  const job = await requireDocImportJob(jobId);
  assertFilesWithinLimits(files);

  const settings = parseDocImportSettings(rawSettings);
  const world = await loadWorldContext(job.targetWorldId!);

  const { hints, warnings: aiWarnings } = await resolveRoleHints(files, settings, world);

  const { plan, existingPages, campaigns } = await buildPlanForJob(
    world.slug,
    world.name,
    files,
    settings,
    hints,
  );

  const preview = buildDocImportPreview(plan.pages, plan.relations, {
    existingPages: existingPages.map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      aliases: Array.isArray(page.aliases) ? (page.aliases as string[]) : [],
    })),
    campaignNames: campaigns.flatMap((campaign) => [campaign.name, campaign.slug]),
    // Was entstanden ist, steht als eigene Karte im Panel (`structure`) — hier
    // stehen nur Dinge, die jemand ansehen sollte, bevor er übernimmt.
    warnings: [...aiWarnings, ...plan.warnings],
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
      structure: plan.structure,
    } as unknown as Record<string, unknown>,
    // Die bestätigten Einstellungen wandern in den Job, damit die Ausführung
    // exakt das erzeugt, was in der Vorschau stand.
    metadata: {
      ...(job.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata)
        ? (job.metadata as Record<string, unknown>)
        : {}),
      docImport: { ...settings },
      docImportRoleHints: serializeRoleHints(hints),
    } as unknown as Record<string, unknown>,
  });

  revalidateImportCentral();
  return { preview, perFile: plan.perFile, structure: plan.structure };
}

/**
 * Liest die Typ-Korrekturen aus der Vorschau.
 *
 * Geprüft statt vertraut: Der Client schickt Schlüssel und Typ, und ein Typ, den
 * es nicht gibt, würde beim Anlegen die ganze Seite scheitern lassen.
 */
function parseTypeOverrides(raw: unknown): Record<string, PageType> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const known = new Set<string>(Object.values(PageTypeEnum));
  const out: Record<string, PageType> = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && known.has(value)) out[key] = value as PageType;
  }

  return out;
}

export async function executeImportDocJobAction(
  jobId: string,
  files: DocImportSourceFile[],
  keys?: string[],
  rawTypeOverrides?: unknown,
): Promise<{ resultSummary: Record<string, unknown>; undoToken: string | null }> {
  await requireStudioActionAuth();

  const job = await requireDocImportJob(jobId);
  assertFilesWithinLimits(files);

  const settings = docImportSettingsFromMetadata(job.metadata);
  const roleHints = roleHintsFromMetadata(job.metadata);
  const world = await loadWorldContext(job.targetWorldId!);

  await importJobs().markExecuting(jobId);

  try {
    const { plan } = await buildPlanForJob(world.slug, world.name, files, settings, roleHints);
    const repo = createUweRepositoryFromClient(prisma);

    const typeOverrides = parseTypeOverrides(rawTypeOverrides);

    const result = await writeDocImport(repo, plan.pages, plan.relations, {
      worldSlug: world.slug,
      confirmed: true,
      keys: keys && keys.length > 0 ? keys : undefined,
      ...(Object.keys(typeOverrides).length > 0 ? { typeOverrides } : {}),
    });

    const resultSummary = {
      created: result.created,
      failed: result.failed,
      linksCreated: result.linksCreated,
      retyped: Object.keys(typeOverrides).length,
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
