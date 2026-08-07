import { readdir, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import type { createPrismaClient } from "@uwe/database/server";
import {
  createImportJobService,
  createUndoService,
  createUweRepositoryFromClient,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  buildDocImportPlan,
  buildDocImportPreview,
  describeStructure,
  DOC_PROFILES,
  type DocImportMode,
  type DocImportPreview,
  type DocImportSourceFile,
  type DocImportStructure,
  type DocProfile,
  type KnownEntity,
  type SectionRole,
} from "@uwe/doc-import";
import { collectRoleHints } from "@uwe/doc-import/ai";
import { writeDocImport } from "@uwe/doc-import/writer";

/**
 * Dokument- und Bulk-Wiki-Import für das Command Center.
 *
 * Dieselbe Maschinerie wie in der Studio-Import-Zentrale (`@uwe/doc-import`),
 * nur ohne Browser dazwischen. Der Unterschied ist die Herkunft der Dateien:
 * hier kommt ein **Pfad auf dem Host**, und die CLI liest ihn selbst. Das ist
 * der eigentliche Gewinn — 200 Vault-Dateien müssen nicht durch einen Upload,
 * sie liegen ja schon auf der Maschine.
 *
 * Kein Auth-Layer, wie im ganzen Ops-Pfad: das Command Center läuft auf dem
 * Host, und der physische Zugang *ist* die Berechtigung (siehe ops-cli.ts).
 * Trotzdem wird der Pfad begrenzt — Dateizahl, Gesamtgröße und Endungen —,
 * damit ein Vertipper nicht das halbe Dateisystem einliest.
 */

type Db = ReturnType<typeof createPrismaClient>;

const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".txt"];
const MAX_FILES = 2000;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_DEPTH = 8;

export interface DocImportTarget {
  slug: string;
  name: string;
  campaigns: Array<{ id: string; name: string; slug: string }>;
  pageCount: number;
}

/** Welten und ihre Kampagnen für die Auswahl im Panel. */
export async function listDocImportTargets(db: Db): Promise<{ worlds: DocImportTarget[] }> {
  const worlds = await db.world.findMany({
    select: {
      slug: true,
      name: true,
      campaigns: { select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } },
      _count: { select: { pages: true } },
    },
    orderBy: { name: "asc" },
  });

  return {
    worlds: worlds.map((world) => ({
      slug: world.slug,
      name: world.name,
      campaigns: world.campaigns,
      pageCount: world._count.pages,
    })),
  };
}

function isMarkdownFile(name: string): boolean {
  const lower = name.toLocaleLowerCase("en");
  return MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * Liest Markdown von einem Pfad — eine Datei oder ein ganzer Ordner.
 *
 * Versteckte Ordner werden übersprungen: ein Obsidian-Vault trägt `.obsidian`
 * und `.trash` mit sich, und beides gehört nicht ins Wiki.
 *
 * **Symlinks:** Beim Absteigen wird keinem gefolgt — `readdir` mit
 * `withFileTypes` meldet den Link selbst, nicht sein Ziel, also sind
 * `isDirectory()` und `isFile()` beide `false` und der Eintrag fällt durch.
 * Der **Startpfad** dagegen wird mit `stat` gelesen und damit sehr wohl
 * aufgelöst. Das ist Absicht: Wer `~/vault` eintippt, meint den Ordner
 * dahinter, auch wenn `~/vault` ein Link ist. Ausgesucht hat ihn ja jemand,
 * der ohnehin vor der Maschine sitzt.
 */
export async function readImportFiles(sourcePath: string): Promise<DocImportSourceFile[]> {
  const resolved = path.resolve(sourcePath);
  const info = await stat(resolved).catch(() => null);

  if (!info) {
    throw new Error(`Pfad nicht gefunden: ${resolved}`);
  }

  const files: DocImportSourceFile[] = [];
  let totalBytes = 0;

  const take = async (filePath: string, displayName: string) => {
    if (files.length >= MAX_FILES) {
      throw new Error(`Zu viele Dateien (max. ${MAX_FILES}).`);
    }

    const content = await readFile(filePath, "utf8");
    totalBytes += content.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error("Die Auswahl ist zu groß (max. 10 MB Text).");
    }
    if (!content.trim()) return;

    files.push({ fileName: displayName, content });
  };

  if (info.isFile()) {
    if (!isMarkdownFile(resolved)) {
      throw new Error("Nur Markdown- und Textdateien (.md, .markdown, .txt).");
    }
    await take(resolved, path.basename(resolved));
    return files;
  }

  const walk = async (dir: string, relative: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH) return;

    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const absolute = path.join(dir, entry.name);
      const display = relative ? `${relative}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(absolute, display, depth + 1);
        continue;
      }
      if (entry.isFile() && isMarkdownFile(entry.name)) {
        await take(absolute, display);
      }
    }
  };

  await walk(resolved, "", 0);

  if (files.length === 0) {
    throw new Error(`Keine Markdown-Dateien unter ${resolved} gefunden (.md, .markdown, .txt).`);
  }

  return files;
}

export interface DocImportRequest {
  path: string;
  worldSlug: string;
  mode: DocImportMode;
  profile: DocProfile;
  /** Zuordnung von der lokalen KI verfeinern lassen, wenn der Maschinenraum-Host antwortet. */
  useAi: boolean;
  /** Herkunft für Audit und reproduzierbare Neuimporte. */
  repository?: string;
  sourceRevision?: string;
  /** `sync` entfernt nur Seiten, die dieser Quelle nachweislich selbst gehören. */
  syncMode: "append" | "sync";
}

function normalizeRequest(input: unknown): DocImportRequest {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const sourcePath = typeof source.path === "string" ? source.path.trim() : "";
  const worldSlug = typeof source.worldSlug === "string" ? source.worldSlug.trim() : "";

  if (!sourcePath) throw new Error("Bitte einen Pfad angeben.");
  if (!worldSlug) throw new Error("Bitte eine Welt auswählen.");

  const mode: DocImportMode = source.mode === "document" ? "document" : "wiki_pages";
  const profile = DOC_PROFILES.includes(source.profile as DocProfile)
    ? (source.profile as DocProfile)
    : "plain";

  // Im Bulk-Modus gibt es nichts einzuordnen: eine Datei ist eine Seite.
  const useAi = mode === "document" && source.useAi !== false;
  const repository = typeof source.repository === "string" ? source.repository.trim() || undefined : undefined;
  const sourceRevision = typeof source.sourceRevision === "string" ? source.sourceRevision.trim() || undefined : undefined;
  const syncMode = source.syncMode === "sync" ? "sync" : "append";

  return { path: sourcePath, worldSlug, mode, profile, useAi, repository, sourceRevision, syncMode };
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function draftHash(draft: { title: string; slug: string; type: string; html: string; parentKey?: string | null }): string {
  return digest(JSON.stringify([draft.title, draft.slug, draft.type, draft.html, draft.parentKey ?? null]));
}

interface RoleHintResult {
  hints: Map<string, Map<string, SectionRole>>;
  warnings: string[];
}

/**
 * Der Feinschliff der letzten Vorschau.
 *
 * Der Umbau selbst ist deterministisch, der Maschinenraum-Host ist es nicht: Zwischen
 * „Vorschau" und „Anlegen" könnte er anders antworten oder gar nicht mehr, und
 * dann entstünde etwas anderes, als in der Vorschau stand. Das Studio legt sein
 * Urteil deshalb im Import-Job ab; hier gibt es keinen Job — aber es gibt genau
 * einen Prozess und genau ein Panel davor, also genügt ein Merkposten.
 *
 * Passt der Schlüssel nicht, wird neu gefragt. Er umfasst deshalb nicht nur die
 * Anfrage, sondern auch die **gelesenen Dateien**: Unter demselben Pfad kann
 * zwischen Vorschau und Ausführung eine andere Datei liegen, und alte Hinweise
 * auf eine neue Gliederung zu legen hieße, stillschweigend etwas anderes zu
 * bauen als das Bestätigte.
 */
let lastRoleHints: { key: string; result: RoleHintResult } | null = null;

function requestKey(request: DocImportRequest, files: DocImportSourceFile[]): string {
  return JSON.stringify([
    request.path,
    request.worldSlug,
    request.mode,
    request.profile,
    request.useAi,
    request.sourceRevision,
    request.syncMode,
    files.map((file) => [file.fileName, file.content.length]),
  ]);
}

/**
 * Holt den KI-Feinschliff, wenn der Maschinenraum-Host antwortet.
 *
 * Wirft nicht: Ein stummer Host ist im Command Center der Normalfall (die
 * Maschine kann laufen, ohne dass das Modell geladen ist), und ein Import, der
 * daran scheitert, wäre für den Betrieb wertlos. Der Grund wandert in die
 * Warnungen der Vorschau.
 */
async function loadRoleHints(
  db: Db,
  request: DocImportRequest,
  files: DocImportSourceFile[],
  world: { name: string; knownEntities: KnownEntity[] },
): Promise<RoleHintResult> {
  if (!request.useAi) return { hints: new Map(), warnings: [] };

  const key = requestKey(request, files);
  if (lastRoleHints?.key === key) return lastRoleHints.result;

  let result: RoleHintResult;
  try {
    const collected = await collectRoleHints(
      { repo: createUweRepositoryFromClient(db), prisma: db },
      {
        profile: request.profile,
        files,
        knownEntities: world.knownEntities,
        worldName: world.name,
      },
    );
    result = { hints: collected.hints, warnings: collected.warnings };
  } catch (error) {
    result = {
      hints: new Map(),
      warnings: [
        `KI-Feinschliff übersprungen (${error instanceof Error ? error.message : "unbekannter Fehler"}) — die Regeln entscheiden.`,
      ],
    };
  }

  lastRoleHints = { key, result };
  return result;
}

async function buildPlan(db: Db, request: DocImportRequest) {
  const repo = createUweRepositoryFromClient(db);
  const world = await repo.getWorldBySlug(request.worldSlug);
  if (!world) {
    throw new Error(`Welt „${request.worldSlug}" wurde nicht gefunden.`);
  }

  const [files, existingPages, campaigns] = await Promise.all([
    readImportFiles(request.path),
    repo.listPagesByWorld(request.worldSlug),
    repo.listCampaignsByWorld(request.worldSlug),
  ]);

  // Was die Welt schon kennt — direkt aus derselben Datenbank, in die dieser
  // Import schreibt. Kein MCP, kein HTTP: Der Command Center läuft auf dem Host.
  const knownEntities: KnownEntity[] = existingPages.map((page) => ({
    title: page.title,
    type: page.type as KnownEntity["type"],
    aliases: Array.isArray(page.aliases) ? (page.aliases as string[]) : [],
  }));

  const { hints, warnings: aiWarnings } = await loadRoleHints(db, request, files, {
    name: world.name,
    knownEntities,
  });

  const plan = buildDocImportPlan(files, {
    mode: request.mode,
    profile: request.profile,
    existingSlugs: existingPages.map((page) => page.slug),
    worldName: world.name,
    worldSlug: request.worldSlug,
    roleHints: hints,
    knownEntities,
  });

  return { repo, plan, existingPages, campaigns, files, aiWarnings };
}

export interface DocImportPreviewResult {
  worldSlug: string;
  fileCount: number;
  pageCount: number;
  perFile: Array<{ fileName: string; pageCount: number }>;
  summary: DocImportPreview["summary"];
  /** „8 Ebenen · 23 Räume · 11 Werteblöcke" — woran man erkennt, ob es gepasst hat. */
  structure: DocImportStructure;
  structureSummary: string;
  warnings: string[];
  unresolvedLinks: string[];
  /** Die ersten Einträge des Baums — genug, um zu erkennen, ob es passt. */
  sample: Array<{ title: string; slug: string; type: string; depth: number; status: string }>;
  sync: { added: number; changed: number; unchanged: number; removed: number; protected: number };
}

export async function previewDocImport(
  db: Db,
  input: unknown,
): Promise<DocImportPreviewResult> {
  const request = normalizeRequest(input);
  const { plan, existingPages, campaigns, files, aiWarnings } = await buildPlan(db, request);
  const source = await db.docImportSource.findUnique({
    where: { worldId_sourcePath: { worldId: existingPages[0]?.worldId ?? (await db.world.findUniqueOrThrow({ where: { slug: request.worldSlug } })).id, sourcePath: path.resolve(request.path) } },
    include: { bindings: true },
  });
  const old = new Map(source?.bindings.map((binding) => [binding.sourceKey, binding]) ?? []);
  const plannedKeys = new Set(plan.pages.map((draft) => draft.key));
  const added = plan.pages.filter((draft) => !old.has(draft.key)).length;
  const changed = plan.pages.filter((draft) => old.has(draft.key) && old.get(draft.key)?.sourceHash !== draftHash(draft)).length;
  const unchanged = plan.pages.length - added - changed;
  const stale = [...old.values()].filter((binding) => !plannedKeys.has(binding.sourceKey));

  const preview = buildDocImportPreview(plan.pages, plan.relations, {
    existingPages: existingPages.map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      aliases: Array.isArray(page.aliases) ? (page.aliases as string[]) : [],
    })),
    campaignNames: campaigns.flatMap((campaign) => [campaign.name, campaign.slug]),
    warnings: [...aiWarnings, ...plan.warnings],
  });

  return {
    worldSlug: request.worldSlug,
    fileCount: files.length,
    pageCount: preview.items.length,
    perFile: plan.perFile,
    summary: preview.summary,
    structure: plan.structure,
    structureSummary: describeStructure(plan.structure.byRole),
    warnings: preview.warnings,
    unresolvedLinks: preview.unresolvedLinks.slice(0, 50),
    sample: preview.items.slice(0, 40).map((item) => ({
      title: item.title,
      slug: item.slug,
      type: item.type,
      depth: item.depth,
      status: item.status,
    })),
    sync: {
      added,
      changed,
      unchanged,
      removed: stale.filter((binding) => binding.ownedPage).length,
      protected: stale.filter((binding) => !binding.ownedPage).length,
    },
  };
}

export interface DocImportExecuteResult {
  worldSlug: string;
  created: number;
  /** Entwürfe, die eine bestehende Seite ergänzt haben statt eine zweite anzulegen. */
  merged: number;
  failed: number;
  linksCreated: number;
  warnings: string[];
  /** Kennung des Rückbau-Eintrags, unter der das Studio den Lauf zurücknimmt. */
  undoToken: string | null;
  sync: { added: number; changed: number; unchanged: number; removed: number; protected: number };
}

/**
 * Schreibt den Import.
 *
 * Der Plan wird hier **neu** aus denselben Dateien gebaut statt aus der
 * Vorschau übernommen: der Weg von Markdown zu Seitenentwürfen ist
 * deterministisch, und so kann zwischen Vorschau und Ausführung kein halb
 * gültiger Zwischenstand hängen bleiben.
 */
export async function executeDocImport(
  db: Db,
  input: unknown,
): Promise<DocImportExecuteResult> {
  const request = normalizeRequest(input);
  const { repo, plan, files } = await buildPlan(db, request);

  const world = await repo.getWorldBySlug(request.worldSlug);
  if (!world) {
    throw new Error(`Welt „${request.worldSlug}" wurde nicht gefunden.`);
  }

  const result = await writeDocImport(repo, plan.pages, plan.relations, {
    worldSlug: request.worldSlug,
    confirmed: true,
  });

  const sourcePath = path.resolve(request.path);
  const previous = await db.docImportSource.findUnique({
    where: { worldId_sourcePath: { worldId: world.id, sourcePath } },
    include: { bindings: true },
  });
  const previousByKey = new Map(previous?.bindings.map((binding) => [binding.sourceKey, binding]) ?? []);
  const writtenByKey = new Map(result.pages.map((page) => [page.key, page]));
  const draftByKey = new Map(plan.pages.map((draft) => [draft.key, draft]));
  const plannedKeys = new Set(plan.pages.map((draft) => draft.key));
  const stale = [...previousByKey.values()].filter((binding) => !plannedKeys.has(binding.sourceKey));
  let removed = 0;
  if (request.syncMode === "sync") {
    const ownedPageIds = stale.filter((binding) => binding.ownedPage).map((binding) => binding.pageId);
    if (ownedPageIds.length > 0) {
      removed = (await db.page.deleteMany({ where: { id: { in: ownedPageIds }, worldId: world.id } })).count;
    }
  }

  const sourceHash = digest(files.map((file) => `${file.fileName}\0${file.content}`).join("\0\0"));
  const campaignIds = await db.page.findMany({
    where: { id: { in: result.pages.map((page) => page.pageId) } },
    select: { id: true, campaignId: true },
  });
  const campaignByPage = new Map(campaignIds.map((page) => [page.id, page.campaignId]));
  const distinctCampaigns = [...new Set(campaignIds.map((page) => page.campaignId).filter(Boolean))];
  const importSource = await db.docImportSource.upsert({
    where: { worldId_sourcePath: { worldId: world.id, sourcePath } },
    create: { worldId: world.id, campaignId: distinctCampaigns.length === 1 ? distinctCampaigns[0] : null, sourcePath, repository: request.repository, sourceRevision: request.sourceRevision, contentHash: sourceHash },
    update: { campaignId: distinctCampaigns.length === 1 ? distinctCampaigns[0] : null, repository: request.repository, sourceRevision: request.sourceRevision, contentHash: sourceHash, importedAt: new Date() },
  });

  for (const page of result.pages) {
    const draft = draftByKey.get(page.key);
    if (!draft) continue;
    const old = previousByKey.get(page.key);
    await db.docImportPageBinding.upsert({
      where: { sourceId_sourceKey: { sourceId: importSource.id, sourceKey: page.key } },
      create: { sourceId: importSource.id, pageId: page.pageId, sourceKey: page.key, sourceHash: draftHash(draft), ownedPage: page.disposition === "created", lastRevision: request.sourceRevision },
      update: { pageId: page.pageId, sourceHash: draftHash(draft), ownedPage: old?.ownedPage ?? page.disposition === "created", lastRevision: request.sourceRevision },
    });

    const parent = draft.parentKey ? draftByKey.get(draft.parentKey) : undefined;
    const parentWritten = draft.parentKey ? writtenByKey.get(draft.parentKey) : undefined;
    if (draft.type === "quest" && parent?.type === "story_arc" && parentWritten) {
      await db.page.update({ where: { id: page.pageId }, data: { questStoryArcId: parentWritten.pageId } });
    }
    if (draft.type === "dungeon") {
      await db.dungeon.upsert({
        where: { rootPageId: page.pageId },
        create: { worldId: world.id, campaignId: campaignByPage.get(page.pageId) ?? null, rootPageId: page.pageId, storyArcPageId: parent?.type === "story_arc" ? parentWritten?.pageId : null, name: draft.title, slug: page.slug },
        update: { campaignId: campaignByPage.get(page.pageId) ?? null, storyArcPageId: parent?.type === "story_arc" ? parentWritten?.pageId : null, name: draft.title, slug: page.slug },
      });
    }
  }
  if (request.syncMode === "sync" && stale.length > 0) {
    await db.docImportPageBinding.deleteMany({ where: { id: { in: stale.map((binding) => binding.id) } } });
  }
  const added = plan.pages.filter((draft) => !previousByKey.has(draft.key)).length;
  const changed = plan.pages.filter((draft) => previousByKey.has(draft.key) && previousByKey.get(draft.key)?.sourceHash !== draftHash(draft)).length;
  const sync = { added, changed, unchanged: plan.pages.length - added - changed, removed, protected: stale.filter((binding) => !binding.ownedPage).length };

  const undoToken = await recordImportRun(db, {
    worldId: world.id,
    request,
    fileCount: files.length,
    createdPageIds: result.undo.createdPageIds,
    updatedPages: result.undo.updatedPages,
    resultSummary: {
      created: result.created,
      merged: result.merged,
      failed: result.failed,
      linksCreated: result.linksCreated,
    },
  });

  return {
    worldSlug: request.worldSlug,
    created: result.created,
    merged: result.merged,
    failed: result.failed,
    linksCreated: result.linksCreated,
    warnings: result.warnings.slice(0, 50),
    undoToken,
    sync,
  };
}

/**
 * Den Lauf so festhalten, dass das Studio ihn zurücknehmen kann.
 *
 * Das Panel verspricht seit jeher „Rückgängig machen geht im Studio über das
 * Aktivitätsprotokoll" — nur hat der Command-Center-Pfad nie einen Eintrag
 * angelegt. Solange ein Import drei Seiten erzeugte, fiel das kaum auf; ein
 * Kampagnenbuch macht daraus fünfzig, und die von Hand wieder einzusammeln ist
 * kein Vorgang, den man jemandem zumuten kann.
 *
 * Scheitert das Protokollieren, scheitert nicht der Import: Die Seiten sind
 * angelegt, und ein fehlender Rückbau-Eintrag ist ein kleineres Übel als eine
 * Fehlermeldung nach getaner Arbeit.
 *
 * Die drei Schritte hängen deshalb **nicht** aneinander. Scheiterte der
 * Rückbau-Eintrag und risse den Abschluss mit, bliebe der Job für immer im
 * Anfangszustand stehen — ein Eintrag im Protokoll, der behauptet, der Import
 * laufe noch, obwohl die Seiten längst da sind. Der Job wird also auch ohne
 * Rückbau-Eintrag abgeschlossen; dass keiner entstand, sagt das Panel.
 */
async function recordImportRun(
  db: Db,
  input: {
    worldId: string;
    request: DocImportRequest;
    fileCount: number;
    createdPageIds: string[];
    updatedPages: Awaited<ReturnType<typeof writeDocImport>>["undo"]["updatedPages"];
    resultSummary: Record<string, number>;
  },
): Promise<string | null> {
  const jobs = createImportJobService(db);

  let jobId: string;
  try {
    const job = await jobs.createJob({
      sourceType: "markdown",
      targetType: "world",
      targetWorldId: input.worldId,
      fileName: input.request.path,
      metadata: {
        origin: "command-center",
        docImport: {
          mode: input.request.mode,
          profile: input.request.profile,
          useAi: input.request.useAi,
        },
        fileCount: input.fileCount,
      },
    });
    jobId = job.id;
  } catch {
    return null;
  }

  let undoToken: string | null = null;
  try {
    // PageLinks hängen per Cascade an ihrer Quellseite — das Löschen der
    // erzeugten Seiten räumt sie mit ab.
    const undoEntry = await createUndoService(brainPrisma, db).captureImportExecute({
      worldId: input.worldId,
      jobId,
      createdPageIds: input.createdPageIds,
      updatedPages: input.updatedPages,
    });
    undoToken = undoEntry?.id ?? null;
  } catch {
    undoToken = null;
  }

  try {
    await jobs.markCompleted(jobId, input.resultSummary, undoToken);
  } catch {
    // Der Import ist durch; ein unvollständiger Protokolleintrag ändert daran
    // nichts und darf den Rückgabewert nicht verfälschen.
  }

  return undoToken;
}
