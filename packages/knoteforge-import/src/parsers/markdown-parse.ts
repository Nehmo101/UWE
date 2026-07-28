import { ImportParseError } from "../interface";
import type { KnoteForgeExportEntity } from "../types";
import { slugifyTitle } from "../slug";

export interface MarkdownDocument {
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

export function parseFrontmatterBlock(block: string): Record<string, string> {
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

  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim() || `Import ${index}`;
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

export function splitMarkdownDocuments(content: string): string[] {
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

export function parseMarkdownDocument(
  rawDocument: string,
  options?: { fallbackTitle?: string; index?: number },
): MarkdownDocument {
  const normalized = rawDocument.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    throw new ImportParseError("Leeres Markdown-Dokument.");
  }

  const fallbackTitle =
    options?.fallbackTitle ?? titleFromFilename(undefined, options?.index ?? 1);

  if (normalized.startsWith("---")) {
    const closingIndex = normalized.indexOf("\n---", 3);
    if (closingIndex !== -1) {
      const frontmatterBlock = normalized.slice(3, closingIndex).trim();
      const body = normalized.slice(closingIndex + 4).trim();
      const frontmatter = parseFrontmatterBlock(frontmatterBlock);
      const title =
        frontmatter.title?.trim() ||
        extractTitleFromBody(body, fallbackTitle);

      return { title, body, frontmatter };
    }
  }

  const title = extractTitleFromBody(normalized, fallbackTitle);
  return { title, body: normalized, frontmatter: {} };
}

export function markdownDocumentsToEntities(
  documents: MarkdownDocument[],
): KnoteForgeExportEntity[] {
  return documents.map((document, index) => {
    const tags = parseTags(document.frontmatter.tags);
    const slug = document.frontmatter.slug?.trim() || slugifyTitle(document.title);
    const type = document.frontmatter.type?.trim() || "wissenstext";

    return {
      id: document.frontmatter.id?.trim() || `md-import-${index + 1}`,
      type,
      title: document.title,
      slug,
      summary: document.frontmatter.summary?.trim() || null,
      content: document.body,
      tags,
      aliases: parseTags(document.frontmatter.aliases),
      visibility: document.frontmatter.visibility ?? null,
      metadata: {
        importFormat: "markdown",
        ...(document.frontmatter.source ? { sourceFile: document.frontmatter.source } : {}),
      },
    };
  });
}

export function parseMarkdownBundle(content: string): KnoteForgeExportEntity[] {
  const chunks = splitMarkdownDocuments(content);
  if (chunks.length === 0) {
    throw new ImportParseError("Kein importierbarer Text gefunden.");
  }

  const documents = chunks.map((chunk, index) =>
    parseMarkdownDocument(chunk, { index: index + 1 }),
  );

  return markdownDocumentsToEntities(documents);
}
