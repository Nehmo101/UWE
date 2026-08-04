import type { ImportSourceType, ImportTargetType } from "../import-constants";

/** Fehler der Import-Zentrale — Nachricht ist nutzerzeigbar. */
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

export interface MarkdownImportExecuteResult {
  created: number;
  updated: number;
  failed: number;
  skipped: number;
  createdIds: string[];
  log: Array<{ title: string; status: "created" | "failed" | "skipped"; message: string }>;
}

/** Ein geparstes Markdown-Dokument — Titel, Rumpf, Frontmatter-Schlüssel. */
export interface ParsedMarkdownDocument {
  title: string;
  body: string;
  frontmatter: Record<string, string>;
}
