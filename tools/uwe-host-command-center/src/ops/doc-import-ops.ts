import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { createPrismaClient } from "@uwe/database/server";
import { createUweRepositoryFromClient } from "@uwe/database/server";
import {
  buildDocImportPlan,
  buildDocImportPreview,
  DOC_PROFILES,
  type DocImportMode,
  type DocImportPreview,
  type DocImportSourceFile,
  type DocProfile,
} from "@uwe/doc-import";
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
 * und `.trash` mit sich, und beides gehört nicht ins Wiki. Symlinks werden
 * nicht verfolgt (`readdir` ohne `follow`), damit ein Vault-Link nicht in den
 * Rest des Dateisystems führt.
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
  maxDepth?: number;
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

  const rawDepth = Number.parseInt(String(source.maxDepth ?? ""), 10);
  const maxDepth = mode === "wiki_pages" ? 1 : Math.min(6, Math.max(1, rawDepth || 3));

  return { path: sourcePath, worldSlug, mode, profile, maxDepth };
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

  const plan = buildDocImportPlan(files, {
    mode: request.mode,
    profile: request.profile,
    maxDepth: request.maxDepth,
    existingSlugs: existingPages.map((page) => page.slug),
    worldName: world.name,
    worldSlug: request.worldSlug,
  });

  return { repo, plan, existingPages, campaigns, files };
}

export interface DocImportPreviewResult {
  worldSlug: string;
  fileCount: number;
  pageCount: number;
  perFile: Array<{ fileName: string; pageCount: number }>;
  summary: DocImportPreview["summary"];
  warnings: string[];
  unresolvedLinks: string[];
  /** Die ersten Einträge des Baums — genug, um zu erkennen, ob es passt. */
  sample: Array<{ title: string; slug: string; type: string; depth: number; status: string }>;
}

export async function previewDocImport(
  db: Db,
  input: unknown,
): Promise<DocImportPreviewResult> {
  const request = normalizeRequest(input);
  const { plan, existingPages, campaigns, files } = await buildPlan(db, request);

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

  return {
    worldSlug: request.worldSlug,
    fileCount: files.length,
    pageCount: preview.items.length,
    perFile: plan.perFile,
    summary: preview.summary,
    warnings: preview.warnings,
    unresolvedLinks: preview.unresolvedLinks.slice(0, 50),
    sample: preview.items.slice(0, 40).map((item) => ({
      title: item.title,
      slug: item.slug,
      type: item.type,
      depth: item.depth,
      status: item.status,
    })),
  };
}

export interface DocImportExecuteResult {
  worldSlug: string;
  created: number;
  failed: number;
  linksCreated: number;
  warnings: string[];
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
  const { repo, plan } = await buildPlan(db, request);

  const result = await writeDocImport(repo, plan.pages, plan.relations, {
    worldSlug: request.worldSlug,
    confirmed: true,
  });

  return {
    worldSlug: request.worldSlug,
    created: result.created,
    failed: result.failed,
    linksCreated: result.linksCreated,
    warnings: result.warnings.slice(0, 50),
  };
}
