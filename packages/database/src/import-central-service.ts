import { brainPrisma, type BrainPrismaClient } from "./brain-client";
import type {
  ImportSourceType,
  ImportTargetType,
  MarkdownImportPreviewItem,
  MarkdownImportPreviewResult,
} from "./import-constants";
import type { PrismaClient } from "./client";
import {
  excerpt,
  mapPageType,
  parseTags,
  resolveMarkdownDocuments,
} from "./import-central/markdown-adapter";
import {
  ImportCentralError,
  type MarkdownImportContext,
  type MarkdownImportExecuteResult,
  type ParsedMarkdownDocument,
} from "./import-central/types";
import { createLifeAdminService, type LifeAdminService } from "./life-admin-service";
import { normalizePdfTextForImport, extractPdfText } from "./pdf-text-extract";
import { slugifyPageTitle } from "./page-templates";
import { createUweRepositoryFromClient, type UweRepository } from "./repository";
import { pickUniqueSlug } from "./slug-utils";

const MAX_CONTENT_BYTES = 10 * 1024 * 1024;
const PDF_NOT_SUPPORTED_MESSAGE =
  "PDF-Import ist für dieses Ziel noch nicht verfügbar. Nutze Life Brain, Capture oder DnD-Seite als Ziel.";

// Die Format-Adapter (Markdown-Parsing, Typ-Mapping) liegen in
// `./import-central/`; dieser Service behält die Orchestrierung. Die
// Re-Exports halten alle bestehenden Import-Pfade stabil.
export { ImportCentralError } from "./import-central/types";
export type {
  MarkdownImportContext,
  MarkdownImportExecuteResult,
} from "./import-central/types";
export type { MarkdownImportPreviewItem, MarkdownImportPreviewResult } from "./import-constants";

function assertContentSize(content: string): void {
  if (content.length > MAX_CONTENT_BYTES) {
    throw new ImportCentralError("Import-Datei ist zu groß (max. 10 MB).");
  }
}

function assertSourceSupported(sourceType: ImportSourceType): void {
  if (sourceType !== "markdown" && sourceType !== "obsidian" && sourceType !== "pdf") {
    throw new ImportCentralError("Diese Quelle wird hier nicht unterstützt.");
  }
}

function assertTargetSupported(targetType: ImportTargetType): void {
  if (
    targetType !== "personal_brain" &&
    targetType !== "capture" &&
    targetType !== "dnd_page"
  ) {
    throw new ImportCentralError("Dieses Ziel wird vom Markdown-Import-Service nicht unterstützt.");
  }
}

function itemIdForIndex(index: number): string {
  return `doc-${index}`;
}

function parseItemIndex(itemId: string): number | null {
  const match = /^doc-(\d+)$/.exec(itemId);
  if (!match?.[1]) return null;
  return Number.parseInt(match[1], 10);
}

export function previewMarkdownImport(
  content: string,
  ctx: MarkdownImportContext,
): MarkdownImportPreviewResult {
  assertSourceSupported(ctx.sourceType);
  assertTargetSupported(ctx.targetType);
  assertContentSize(content);

  const errors: string[] = [];
  let documents: ParsedMarkdownDocument[];

  try {
    documents = resolveMarkdownDocuments(content, ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Markdown konnte nicht gelesen werden.";
    return {
      items: [],
      totalDocuments: 0,
      errors: [message],
      canExecute: false,
    };
  }

  const items: MarkdownImportPreviewItem[] = documents.map((document, index) => ({
    itemId: itemIdForIndex(index),
    title: document.title,
    excerpt: excerpt(document.body),
    pageType: ctx.targetType === "dnd_page" ? mapPageType(document.frontmatter.type) : undefined,
    category: document.frontmatter.category?.trim() || null,
    tags: parseTags(document.frontmatter.tags),
  }));

  if (ctx.targetType === "dnd_page" && (!ctx.worldId || !ctx.worldSlug)) {
    errors.push("Welt-Kontext fehlt für den DnD-Seiten-Import.");
  }

  return {
    items,
    totalDocuments: items.length,
    errors,
    canExecute: items.length > 0 && errors.length === 0,
  };
}

async function executePersonalBrainImport(
  lifeAdmin: LifeAdminService,
  documents: ParsedMarkdownDocument[],
  selectedIndexes: Set<number>,
): Promise<MarkdownImportExecuteResult> {
  const result: MarkdownImportExecuteResult = {
    created: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    createdIds: [],
    log: [],
  };

  for (const [index, document] of documents.entries()) {
    if (!selectedIndexes.has(index)) {
      result.skipped += 1;
      result.log.push({
        title: document.title,
        status: "skipped",
        message: "Nicht ausgewählt.",
      });
      continue;
    }

    try {
      const created = await lifeAdmin.createPersonalBrainDocument({
        title: document.title,
        content: document.body,
        category: document.frontmatter.category?.trim() || "import",
        tags: parseTags(document.frontmatter.tags),
        metadata: {
          source: "import-central",
          importFormat: "markdown",
          ...(document.frontmatter.source ? { sourceFile: document.frontmatter.source } : {}),
        },
      });
      result.created += 1;
      result.createdIds.push(created.id);
      result.log.push({
        title: document.title,
        status: "created",
        message: "Life-Brain-Dokument erstellt.",
      });
    } catch (error) {
      result.failed += 1;
      result.log.push({
        title: document.title,
        status: "failed",
        message: error instanceof Error ? error.message : "Import fehlgeschlagen.",
      });
    }
  }

  return result;
}

async function executeCaptureImport(
  lifeAdmin: LifeAdminService,
  documents: ParsedMarkdownDocument[],
  selectedIndexes: Set<number>,
): Promise<MarkdownImportExecuteResult> {
  const result: MarkdownImportExecuteResult = {
    created: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    createdIds: [],
    log: [],
  };

  for (const [index, document] of documents.entries()) {
    if (!selectedIndexes.has(index)) {
      result.skipped += 1;
      result.log.push({
        title: document.title,
        status: "skipped",
        message: "Nicht ausgewählt.",
      });
      continue;
    }

    try {
      const created = await lifeAdmin.createCapture({
        title: document.title,
        content: document.body,
        captureType: "quick_note",
        metadata: {
          source: "import-central",
          importFormat: "markdown",
          ...(document.frontmatter.source ? { sourceFile: document.frontmatter.source } : {}),
        },
      });
      result.created += 1;
      result.createdIds.push(created.id);
      result.log.push({
        title: document.title,
        status: "created",
        message: "Capture-Eintrag erstellt.",
      });
    } catch (error) {
      result.failed += 1;
      result.log.push({
        title: document.title,
        status: "failed",
        message: error instanceof Error ? error.message : "Import fehlgeschlagen.",
      });
    }
  }

  return result;
}

async function executeDndPageImport(
  repo: UweRepository,
  documents: ParsedMarkdownDocument[],
  ctx: MarkdownImportContext,
): Promise<MarkdownImportExecuteResult> {
  const result: MarkdownImportExecuteResult = {
    created: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    createdIds: [],
    log: [],
  };

  if (!ctx.worldId || !ctx.worldSlug) {
    throw new ImportCentralError("Welt-Kontext fehlt für den DnD-Seiten-Import.");
  }

  const document = documents[0];
  if (!document) {
    throw new ImportCentralError("Kein Markdown-Inhalt zum Importieren.");
  }

  try {
    const existingPages = await repo.listPagesByWorld(ctx.worldSlug);
    const existingSlugs = new Set(existingPages.map((page) => page.slug));
    const preferredSlug =
      document.frontmatter.slug?.trim() || slugifyPageTitle(document.title);
    const slug = pickUniqueSlug(preferredSlug, existingSlugs);
    const pageType = mapPageType(document.frontmatter.type);

    const page = await repo.createPage({
      worldId: ctx.worldId,
      title: document.title,
      slug,
      type: pageType,
      summary: document.frontmatter.summary?.trim() || null,
      tags: parseTags(document.frontmatter.tags) ?? ["import-central"],
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          content: document.body,
          metadata: {
            source: "import-central",
            importFormat: "markdown",
            ...(document.frontmatter.source ? { sourceFile: document.frontmatter.source } : {}),
          },
        },
      ],
    });

    result.created = 1;
    result.createdIds.push(page.id);
    result.log.push({
      title: document.title,
      status: "created",
      message: `DnD-Seite erstellt (${slug}).`,
    });
  } catch (error) {
    result.failed = 1;
    result.log.push({
      title: document.title,
      status: "failed",
      message: error instanceof Error ? error.message : "Import fehlgeschlagen.",
    });
  }

  return result;
}

export async function executeMarkdownImport(
  db: PrismaClient,
  content: string,
  ctx: MarkdownImportContext,
  options?: {
    itemIds?: string[];
    /**
     * Brain client override for tests. Personal-brain and capture targets write
     * through the process-wide `brainPrisma` singleton by default; tests that
     * assert document counts need a fully isolated brain DB instead, because
     * node --test runs test files in parallel against the one shared singleton.
     */
    brainDb?: BrainPrismaClient;
  },
): Promise<MarkdownImportExecuteResult> {
  assertSourceSupported(ctx.sourceType);
  assertTargetSupported(ctx.targetType);
  assertContentSize(content);

  const documents = resolveMarkdownDocuments(content, ctx);
  const selectedIndexes = new Set<number>();

  if (options?.itemIds && options.itemIds.length > 0) {
    for (const itemId of options.itemIds) {
      const index = parseItemIndex(itemId);
      if (index !== null && index >= 0 && index < documents.length) {
        selectedIndexes.add(index);
      }
    }
  } else {
    for (let index = 0; index < documents.length; index += 1) {
      selectedIndexes.add(index);
    }
  }

  const lifeAdmin = createLifeAdminService(options?.brainDb ?? brainPrisma, db);
  const repo = createUweRepositoryFromClient(db);

  switch (ctx.targetType) {
    case "personal_brain":
      return executePersonalBrainImport(lifeAdmin, documents, selectedIndexes);
    case "capture":
      return executeCaptureImport(lifeAdmin, documents, selectedIndexes);
    case "dnd_page":
      return executeDndPageImport(repo, documents, ctx);
    default:
      throw new ImportCentralError("Unbekanntes Import-Ziel.");
  }
}

export async function previewPdfImport(
  buffer: Buffer,
  ctx: MarkdownImportContext,
): Promise<MarkdownImportPreviewResult> {
  assertSourceSupported(ctx.sourceType);
  assertTargetSupported(ctx.targetType);

  try {
    const text = await extractPdfText(buffer);
    const markdown = normalizePdfTextForImport(text, ctx.fileName);
    return previewMarkdownImport(markdown, { ...ctx, sourceType: "markdown" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF konnte nicht gelesen werden.";
    return {
      items: [],
      totalDocuments: 0,
      errors: [message],
      canExecute: false,
    };
  }
}

export async function executePdfImport(
  db: PrismaClient,
  buffer: Buffer,
  ctx: MarkdownImportContext,
  options?: { itemIds?: string[] },
): Promise<MarkdownImportExecuteResult> {
  const text = await extractPdfText(buffer);
  const markdown = normalizePdfTextForImport(text, ctx.fileName);
  return executeMarkdownImport(
    db,
    markdown,
    { ...ctx, sourceType: "markdown" },
    options,
  );
}

export { PDF_NOT_SUPPORTED_MESSAGE };
