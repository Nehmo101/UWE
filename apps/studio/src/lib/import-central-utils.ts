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
    return MARKDOWN_TARGET_TYPES.has(targetType);
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

export function importCentralUsesWorldTarget(targetType: ImportTargetType): boolean {
  return targetType === "world" || targetType === "dnd_page";
}

export { sourceTypeToFormat as importCentralSourceFormat };
