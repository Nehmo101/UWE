// Client-safe import-job constants and types.
//
// This module must stay free of runtime imports (Prisma client, Node-only
// modules) so that client components can import the label maps without
// pulling the server-only dependency graph into the browser bundle.
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
};
