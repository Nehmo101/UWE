import type { ImportSourceType, ImportTargetType, PageType } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { createLifeAdminService, type LifeAdminService } from "./life-admin-service";
import { slugifyPageTitle } from "./page-templates";
import { createUweRepositoryFromClient, type UweRepository } from "./repository";
import { pickUniqueSlug } from "./slug-utils";

const MAX_CONTENT_BYTES = 10 * 1024 * 1024;
const PDF_NOT_SUPPORTED_MESSAGE =
  "PDF-Import ist noch nicht verfügbar. Bitte exportiere den Inhalt als Markdown oder Obsidian-Vault und importiere ihn erneut.";

export class ImportCentralError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportCentralError";
  }
}

export interface MarkdownImportContext {
  targetType: ImportTargetType;
  sourceType: ImportSourceType;
  fileName?: string | null;
  worldId?: string | null;
  worldSlug?: string | null;
}

export interface MarkdownImportPreviewItem {
  itemId: string;
  title: string;
  excerpt: string;
  pageType?: string;
  category?: string | null;
  tags?: string[];
}

export interface MarkdownImportPreviewResult {
  items: MarkdownImportPreviewItem[];
  totalDocuments: number;
  errors: string[];
  canExecute: boolean;
}

export interface MarkdownImportExecuteResult {
  created: number;
  updated: number;
  failed: number;
  skipped: number;
  createdIds: string[];
  log: Array<{ title: string; status: "created" | "failed" | "skipped"; message: string }>;
}

interface ParsedMarkdownDocument {
  title: string;
  body: string;
  frontmatter: Record<string, string>;
}

function parseFrontmatterValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatterBlock(block: string): Record<string, string> {
  const frontmatter: Record<string, string> = {};

  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex <= 0) continue;

    const key = trimmed.slice(0, colonIndex).trim().toLocaleLowerCase("de");
    const value = parseFrontmatterValue(trimmed.slice(colonIndex + 1));
    frontmatter[key] = value;
  }

  return frontmatter;
}

function parseTags(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }
  return trimmed
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function extractTitleFromBody(body: string, fallback: string): string {
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headingMatch = /^#{1,3}\s+(.+)$/.exec(trimmed);
    if (headingMatch?.[1]) {
      return headingMatch[1].trim();
    }

    if (trimmed.length <= 120) {
      return trimmed;
    }

    break;
  }

  return fallback;
}

function titleFromFilename(filename: string | undefined, index: number): string {
  if (!filename?.trim()) {
    return `Import ${index}`;
  }

  return (
    filename
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim() || `Import ${index}`
  );
}

function skipLeadingSeparators(content: string, index: number): number {
  let cursor = index;
  while (cursor < content.length) {
    if (content.startsWith("\n", cursor)) {
      cursor += 1;
      continue;
    }
    if (content.startsWith("---", cursor)) {
      const after = content.slice(cursor + 3);
      if (after.length === 0 || after.startsWith("\n")) {
        const afterNewlines = after.replace(/^\n+/, "");
        if (/^[A-Za-z_][\w-]*\s*:/.test(afterNewlines)) {
          break;
        }
        cursor += 3;
        while (content[cursor] === "\n") cursor += 1;
        continue;
      }
    }
    break;
  }
  return cursor;
}

function findDocumentSeparator(content: string, fromIndex: number): number {
  for (let index = fromIndex; index < content.length; index++) {
    if (!content.startsWith("\n---", index)) continue;

    const lineEnd = content.indexOf("\n", index + 1);
    const line = content.slice(index + 1, lineEnd === -1 ? content.length : lineEnd).trim();
    if (line !== "---") continue;

    const nextIndex = lineEnd === -1 ? content.length : lineEnd + 1;
    const nextLineEnd = content.indexOf("\n", nextIndex);
    const nextLine = content
      .slice(nextIndex, nextLineEnd === -1 ? content.length : nextLineEnd)
      .trim();

    if (nextLine === "" || nextLine === "---" || nextLine.startsWith("#")) {
      return index;
    }
  }

  return -1;
}

function readFrontmatterDocument(content: string, start: number): { raw: string; nextIndex: number } {
  const openingEnd = content.indexOf("\n", start + 3);
  if (openingEnd === -1) {
    return { raw: content.slice(start).trim(), nextIndex: content.length };
  }

  const closingMarker = content.indexOf("\n---", openingEnd + 1);
  if (closingMarker === -1) {
    return { raw: content.slice(start).trim(), nextIndex: content.length };
  }

  const closingLineEnd = content.indexOf("\n", closingMarker + 1);
  const bodyStart = closingLineEnd === -1 ? content.length : closingLineEnd + 1;
  const separatorIndex = findDocumentSeparator(content, bodyStart);
  const end = separatorIndex === -1 ? content.length : separatorIndex;

  return {
    raw: content.slice(start, end).trim(),
    nextIndex: separatorIndex === -1 ? content.length : separatorIndex,
  };
}

function readPlainDocument(content: string, start: number): { raw: string; nextIndex: number } {
  const separatorIndex = findDocumentSeparator(content, start);
  const end = separatorIndex === -1 ? content.length : separatorIndex;
  return {
    raw: content.slice(start, end).trim(),
    nextIndex: end,
  };
}

function splitMarkdownDocuments(content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const documents: string[] = [];
  let index = skipLeadingSeparators(normalized, 0);

  while (index < normalized.length) {
    const chunk =
      normalized.startsWith("---", index) && normalized[index + 3] === "\n"
        ? readFrontmatterDocument(normalized, index)
        : readPlainDocument(normalized, index);

    if (chunk.raw) {
      documents.push(chunk.raw);
    }

    index = skipLeadingSeparators(normalized, chunk.nextIndex);
  }

  return documents;
}

function splitByH2Headers(content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const parts: string[] = [];
  let current = "";
  let foundHeading = false;

  for (const line of normalized.split("\n")) {
    if (/^##\s+/.test(line)) {
      foundHeading = true;
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = `${line}\n`;
      continue;
    }
    current += `${line}\n`;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return foundHeading && parts.length > 1 ? parts : [normalized];
}

function parseMarkdownDocument(
  rawDocument: string,
  options?: { fallbackTitle?: string; index?: number },
): ParsedMarkdownDocument {
  const normalized = rawDocument.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    throw new ImportCentralError("Leeres Markdown-Dokument.");
  }

  const fallbackTitle =
    options?.fallbackTitle ?? titleFromFilename(undefined, options?.index ?? 1);

  if (normalized.startsWith("---")) {
    const closingIndex = normalized.indexOf("\n---", 3);
    if (closingIndex !== -1) {
      const frontmatterBlock = normalized.slice(3, closingIndex).trim();
      const body = normalized.slice(closingIndex + 4).trim();
      const frontmatter = parseFrontmatterBlock(frontmatterBlock);
      const title = frontmatter.title?.trim() || extractTitleFromBody(body, fallbackTitle);

      return { title, body, frontmatter };
    }
  }

  const title = extractTitleFromBody(normalized, fallbackTitle);
  return { title, body: normalized, frontmatter: {} };
}

function resolveMarkdownDocuments(
  content: string,
  ctx: MarkdownImportContext,
): ParsedMarkdownDocument[] {
  if (ctx.targetType === "dnd_page") {
    const fallbackTitle = titleFromFilename(ctx.fileName ?? undefined, 1);
    return [parseMarkdownDocument(content, { fallbackTitle, index: 1 })];
  }

  const separatorChunks = splitMarkdownDocuments(content);
  const rawChunks =
    separatorChunks.length <= 1 ? splitByH2Headers(content) : separatorChunks;

  if (rawChunks.length === 0) {
    throw new ImportCentralError("Kein importierbarer Text gefunden.");
  }

  return rawChunks.map((chunk, index) =>
    parseMarkdownDocument(chunk, {
      fallbackTitle: titleFromFilename(ctx.fileName ?? undefined, index + 1),
      index: index + 1,
    }),
  );
}

function excerpt(text: string, maxLength = 160): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
}

function assertContentSize(content: string): void {
  if (content.length > MAX_CONTENT_BYTES) {
    throw new ImportCentralError("Import-Datei ist zu groß (max. 10 MB).");
  }
}

function assertSourceSupported(sourceType: ImportSourceType): void {
  if (sourceType === "pdf") {
    throw new ImportCentralError(PDF_NOT_SUPPORTED_MESSAGE);
  }
  if (sourceType !== "markdown" && sourceType !== "obsidian") {
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

function mapPageType(raw: string | undefined): PageType {
  const normalized = raw?.trim().toLocaleLowerCase("de") ?? "";
  const mapping: Record<string, PageType> = {
    wissenstext: "lore",
    lore: "lore",
    location: "location",
    ort: "location",
    region: "region",
    npc: "npc",
    faction: "faction",
    item: "item",
    dungeon: "dungeon",
    ebene: "dungeon_level",
    dungeon_level: "dungeon_level",
    room: "room",
    raum: "room",
    encounter: "encounter",
    trap: "trap",
    puzzle: "puzzle",
    loot: "loot",
    secret: "secret",
    session: "session",
    quest: "quest",
    handout: "handout",
    rule: "rule",
    note: "note",
    monster: "monster",
    map: "map",
  };

  return mapping[normalized] ?? "lore";
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
          visibility: "dm_only",
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
  options?: { itemIds?: string[] },
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

  const lifeAdmin = createLifeAdminService(db);
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

export { PDF_NOT_SUPPORTED_MESSAGE };
