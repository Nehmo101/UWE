import type {
  ImportJobStatus,
  ImportSourceType,
  ImportTargetType,
} from "./generated/prisma/client";

export type {
  ImportJobStatus,
  ImportSourceType,
  ImportTargetType,
} from "./generated/prisma/client";

export const IMPORT_JOB_STATUS_LABELS: Record<ImportJobStatus, string> = {
  pending: "Ausstehend",
  preview: "Vorschau",
  executing: "Wird ausgeführt",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
  rolled_back: "Zurückgerollt",
};

export const IMPORT_SOURCE_TYPE_LABELS: Record<ImportSourceType, string> = {
  knoteforge: "KnoteForge JSON",
  obsidian: "Obsidian",
  pdf: "PDF",
  markdown: "Markdown",
  bulk_image: "Bulk-Bilder",
};

export const IMPORT_TARGET_TYPE_LABELS: Record<ImportTargetType, string> = {
  world: "Welt",
  personal_brain: "Life Brain",
  capture: "Capture",
  dnd_page: "DnD-Seite",
  campaign: "Kampagne",
};

/** Client-safe preview shapes for Import Central panels. */
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
