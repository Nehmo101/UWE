import type { ImportSourceType, ImportTargetType } from "@uwe/database/server";

const STUB_SOURCE_TYPES = new Set<ImportSourceType>(["obsidian", "pdf"]);
const STUB_TARGET_TYPES = new Set<ImportTargetType>(["personal_brain", "capture", "dnd_page"]);

function sourceTypeToFormat(sourceType: ImportSourceType): "json" | "markdown" | null {
  switch (sourceType) {
    case "knoteforge":
      return "json";
    case "markdown":
      return "markdown";
    default:
      return null;
  }
}

export function isImportCentralComboSupported(
  sourceType: ImportSourceType,
  targetType: ImportTargetType,
): boolean {
  if (STUB_SOURCE_TYPES.has(sourceType) || STUB_TARGET_TYPES.has(targetType)) {
    return false;
  }
  return sourceTypeToFormat(sourceType) !== null && targetType === "world";
}

export function isImportCentralSourceComingSoon(sourceType: ImportSourceType): boolean {
  return STUB_SOURCE_TYPES.has(sourceType);
}

export function isImportCentralTargetComingSoon(targetType: ImportTargetType): boolean {
  return STUB_TARGET_TYPES.has(targetType);
}

export function importCentralSourceAccept(sourceType: ImportSourceType): string {
  switch (sourceType) {
    case "knoteforge":
      return ".json,application/json";
    case "markdown":
      return ".md,.markdown,.txt,text/markdown,text/plain";
    default:
      return "";
  }
}
