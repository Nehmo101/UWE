/**
 * Einstellungen eines Dokument-/Bulk-Wiki-Imports.
 *
 * Sie werden bei der Vorschau in `ImportJob.metadata` abgelegt und beim Ausführen
 * von dort gelesen — nicht erneut vom Client entgegengenommen. Sonst könnten
 * Vorschau und Ausführung mit unterschiedlicher Baumtiefe laufen, und der Nutzer
 * bekäme etwas anderes, als er bestätigt hat.
 */

import { DOC_PROFILES, type DocImportMode, type DocProfile } from "@uwe/doc-import";

export interface DocImportSettings {
  mode: DocImportMode;
  profile: DocProfile;
  maxDepth: number;
}

export const DOC_IMPORT_MODES: readonly DocImportMode[] = ["wiki_pages", "document"] as const;

export const DOC_IMPORT_MODE_LABELS: Record<DocImportMode, string> = {
  wiki_pages: "Wiki-Seiten",
  document: "Dokument / Buch",
};

export const DOC_IMPORT_MODE_HINTS: Record<DocImportMode, string> = {
  wiki_pages:
    "Eine Datei wird eine Seite — auch wenn viele Überschriften darin stehen. Für Bulk-Uploads aus dem Vault.",
  document:
    "Eine Datei wird ein Seitenbaum in Lesereihenfolge. Für Kampagnenbücher, Dungeons und Weltkanon.",
};

export const MIN_DOC_IMPORT_DEPTH = 1;
export const MAX_DOC_IMPORT_DEPTH = 6;

export const DEFAULT_DOC_IMPORT_SETTINGS: DocImportSettings = {
  mode: "wiki_pages",
  profile: "plain",
  maxDepth: 3,
};

function isDocImportMode(value: unknown): value is DocImportMode {
  return typeof value === "string" && DOC_IMPORT_MODES.includes(value as DocImportMode);
}

function isDocProfile(value: unknown): value is DocProfile {
  return typeof value === "string" && DOC_PROFILES.includes(value as DocProfile);
}

function clampDepth(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_DOC_IMPORT_SETTINGS.maxDepth;
  return Math.min(MAX_DOC_IMPORT_DEPTH, Math.max(MIN_DOC_IMPORT_DEPTH, Math.trunc(parsed)));
}

/** Liest die Einstellungen aus unsicheren Eingaben; alles Unbekannte fällt auf die Vorgabe zurück. */
export function parseDocImportSettings(raw: unknown): DocImportSettings {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const mode = isDocImportMode(source.mode) ? source.mode : DEFAULT_DOC_IMPORT_SETTINGS.mode;

  return {
    mode,
    profile: isDocProfile(source.profile) ? source.profile : DEFAULT_DOC_IMPORT_SETTINGS.profile,
    // Im Bulk-Modus ist die Tiefe bedeutungslos: eine Datei ist eine Seite.
    maxDepth: mode === "wiki_pages" ? 1 : clampDepth(source.maxDepth),
  };
}

/** Zieht die Einstellungen aus `ImportJob.metadata`. */
export function docImportSettingsFromMetadata(metadata: unknown): DocImportSettings {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return DEFAULT_DOC_IMPORT_SETTINGS;
  }
  return parseDocImportSettings((metadata as Record<string, unknown>).docImport);
}
