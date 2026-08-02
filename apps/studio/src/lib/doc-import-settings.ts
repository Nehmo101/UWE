/**
 * Einstellungen eines Dokument-/Bulk-Wiki-Imports.
 *
 * Sie werden bei der Vorschau in `ImportJob.metadata` abgelegt und beim Ausführen
 * von dort gelesen — nicht erneut vom Client entgegengenommen. Sonst könnten
 * Vorschau und Ausführung mit unterschiedlichen Einstellungen laufen, und der
 * Nutzer bekäme etwas anderes, als er bestätigt hat.
 *
 * **Die Überschriftentiefe ist keine Einstellung mehr.** Sie war die falsche
 * Frage: „Bis Ebene 3 aufteilen" heißt „mach aus jeder Überschrift bis Ebene 3
 * eine Seite", und genau daraus entstanden Wikis aus 176 Fragmenten. Welche
 * Abschnitte eine eigene Seite verdienen, entscheidet jetzt der semantische
 * Umbau in `@uwe/doc-import` — Ebenen, Räume, NSC, Begegnungen, Handouts.
 *
 * **Die KI-Hinweise gehören ebenfalls in den Job.** Der Umbau selbst ist
 * deterministisch, der RTX-Host ist es nicht: Zwischen Vorschau und Ausführung
 * könnte er anders antworten oder gar nicht mehr. Deshalb wird das Ergebnis des
 * Feinschliffs mitgespeichert und beim Ausführen wiederverwendet.
 */

import {
  AI_ASSIGNABLE_ROLES,
  DOC_PROFILES,
  type DocImportMode,
  type DocProfile,
  type SectionRole,
} from "@uwe/doc-import";

export interface DocImportSettings {
  mode: DocImportMode;
  profile: DocProfile;
  /**
   * Zuordnung von der lokalen KI verfeinern lassen, wenn der RTX-Host
   * erreichbar ist. Ohne Host läuft der Import unverändert über die Regeln.
   */
  useAi: boolean;
}

/** Dateiname → (Dokumentpfad → Rolle), so wie es in den Job passt. */
export type SerializedRoleHints = Record<string, Record<string, string>>;

export const DOC_IMPORT_MODES: readonly DocImportMode[] = ["wiki_pages", "document"] as const;

export const DOC_IMPORT_MODE_LABELS: Record<DocImportMode, string> = {
  wiki_pages: "Wiki-Seiten",
  document: "Kampagne / Dungeon / Buch",
};

export const DOC_IMPORT_MODE_HINTS: Record<DocImportMode, string> = {
  wiki_pages:
    "Eine Datei wird eine Seite — auch wenn viele Überschriften darin stehen. Für Bulk-Uploads aus dem Vault.",
  document:
    "Ein Dokument wird ein Seitenbaum aus Gegenständen: Ebenen, Räume, NSC, Begegnungen, Handouts, Werteblöcke. Nicht eine Seite pro Überschrift.",
};

export const DEFAULT_DOC_IMPORT_SETTINGS: DocImportSettings = {
  mode: "wiki_pages",
  profile: "plain",
  useAi: true,
};

function isDocImportMode(value: unknown): value is DocImportMode {
  return typeof value === "string" && DOC_IMPORT_MODES.includes(value as DocImportMode);
}

function isDocProfile(value: unknown): value is DocProfile {
  return typeof value === "string" && DOC_PROFILES.includes(value as DocProfile);
}

/** Liest die Einstellungen aus unsicheren Eingaben; alles Unbekannte fällt auf die Vorgabe zurück. */
export function parseDocImportSettings(raw: unknown): DocImportSettings {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const mode = isDocImportMode(source.mode) ? source.mode : DEFAULT_DOC_IMPORT_SETTINGS.mode;

  return {
    mode,
    profile: isDocProfile(source.profile) ? source.profile : DEFAULT_DOC_IMPORT_SETTINGS.profile,
    // Im Bulk-Modus gibt es nichts einzuordnen: eine Datei ist eine Seite.
    useAi: mode === "document" && source.useAi !== false,
  };
}

/** Zieht die Einstellungen aus `ImportJob.metadata`. */
export function docImportSettingsFromMetadata(metadata: unknown): DocImportSettings {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return DEFAULT_DOC_IMPORT_SETTINGS;
  }
  return parseDocImportSettings((metadata as Record<string, unknown>).docImport);
}

const ASSIGNABLE = new Set<string>(AI_ASSIGNABLE_ROLES);

export function serializeRoleHints(
  hints: Map<string, Map<string, SectionRole>>,
): SerializedRoleHints {
  const out: SerializedRoleHints = {};
  for (const [fileName, byPath] of hints) {
    out[fileName] = Object.fromEntries(byPath);
  }
  return out;
}

/**
 * Liest die gespeicherten Hinweise zurück.
 *
 * Auch hier wird geprüft statt vertraut: Ein Job kann alt sein, und eine Rolle,
 * die es nicht mehr gibt, darf den Import nicht kippen.
 */
export function roleHintsFromMetadata(metadata: unknown): Map<string, Map<string, SectionRole>> {
  const hints = new Map<string, Map<string, SectionRole>>();
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return hints;

  const raw = (metadata as Record<string, unknown>).docImportRoleHints;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return hints;

  for (const [fileName, byPath] of Object.entries(raw as Record<string, unknown>)) {
    if (!byPath || typeof byPath !== "object" || Array.isArray(byPath)) continue;

    const map = new Map<string, SectionRole>();
    for (const [path, role] of Object.entries(byPath as Record<string, unknown>)) {
      if (typeof role === "string" && ASSIGNABLE.has(role)) map.set(path, role as SectionRole);
    }
    if (map.size > 0) hints.set(fileName, map);
  }

  return hints;
}
