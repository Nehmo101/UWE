import type { ImportFormat } from "@uwe/knoteforge-import";
import type { ImportSourceType, ImportTargetType } from "@uwe/database/import-constants";

const MARKDOWN_SOURCE_TYPES = new Set<ImportSourceType>(["markdown", "obsidian"]);
const MARKDOWN_TARGET_TYPES = new Set<ImportTargetType>([
  "personal_brain",
  "capture",
  "dnd_page",
]);

function sourceTypeToFormat(sourceType: ImportSourceType): "json" | "markdown" | null {
  switch (sourceType) {
    case "knoteforge":
      return "json";
    case "markdown":
    case "obsidian":
    case "pdf":
      return "markdown";
    default:
      return null;
  }
}

export function isImportCentralComboSupported(
  sourceType: ImportSourceType,
  targetType: ImportTargetType,
): boolean {
  if (sourceType === "pdf") {
    return MARKDOWN_TARGET_TYPES.has(targetType) || targetType === "campaign";
  }

  if (sourceType === "knoteforge") {
    return targetType === "world";
  }

  if (MARKDOWN_SOURCE_TYPES.has(sourceType)) {
    return targetType === "world" || MARKDOWN_TARGET_TYPES.has(targetType);
  }

  return false;
}

export function isImportCentralSourceComingSoon(_sourceType: ImportSourceType): boolean {
  return false;
}

export function isImportCentralTargetComingSoon(_targetType: ImportTargetType): boolean {
  return false;
}

export function isImportCentralMarkdownTarget(targetType: ImportTargetType): boolean {
  return MARKDOWN_TARGET_TYPES.has(targetType);
}

export function isImportCentralPdfSource(sourceType: ImportSourceType): boolean {
  return sourceType === "pdf";
}

export function isImportCentralObsidianSource(sourceType: ImportSourceType): boolean {
  return sourceType === "obsidian";
}

export function importCentralSourceAccept(sourceType: ImportSourceType): string {
  switch (sourceType) {
    case "knoteforge":
      return ".json,application/json";
    case "markdown":
      return ".md,.markdown,.txt,text/markdown,text/plain";
    case "obsidian":
      return ".md,.markdown,.txt,.zip,text/markdown,text/plain,application/zip";
    case "pdf":
      return ".pdf,application/pdf";
    default:
      return "";
  }
}

export function isImportCampaignTarget(targetType: ImportTargetType): boolean {
  return targetType === "campaign";
}

export function importCentralUsesWorldTarget(targetType: ImportTargetType): boolean {
  return targetType === "world" || targetType === "dnd_page" || targetType === "campaign";
}

export { sourceTypeToFormat as importCentralSourceFormat };

/** Dateiendung → Import-Format des Welt-Imports (null: nicht unterstützt). */
export function formatFromFileName(fileName: string): ImportFormat | null {
  const lower = fileName.toLocaleLowerCase("de");
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
    return "markdown";
  }
  return null;
}

/** Verpackt eine Datei ohne Frontmatter in ein Markdown-Dokument mit Titel. */
export function buildMarkdownDocumentFromFile(fileName: string, text: string): string {
  const title = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("---")) {
    return trimmed;
  }

  return `---
title: ${title}
source: ${fileName}
---

${trimmed}`;
}

/** Mehrere Dateien zu einem Markdown-Strom mit `---`-Trennern. */
export function combineImportFiles(files: Array<{ name: string; text: string }>): string {
  return files
    .map((file) => buildMarkdownDocumentFromFile(file.name, file.text))
    .filter(Boolean)
    .join("\n\n---\n\n");
}

/** Undo-Token aus Antwort oder Ergebnis-Payload — Antwort gewinnt. */
export function extractImportUndoToken(
  payload: unknown,
  responseUndoEntryId?: string | null,
): string | null {
  if (typeof responseUndoEntryId === "string" && responseUndoEntryId) {
    return responseUndoEntryId;
  }
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as { undoEntryId?: string | null };
  return typeof record.undoEntryId === "string" && record.undoEntryId ? record.undoEntryId : null;
}
