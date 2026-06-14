import type { CanonConflictHint, DndContextDescriptor } from "./types";

/** Terra-specific hard rules — only applied when world slug matches, never hardcoded as sole world. */
const TERRA_ROUND_TOWER_KEYWORDS = ["magister", "nepurga", "turm", "tower"];

export interface CanonCheckInput {
  worldSlug: string;
  context: DndContextDescriptor;
  pageTitle?: string;
  pageContent?: string;
  canonicalStatus?: string;
  duplicateTitles?: string[];
}

export function checkTerraRoundTowerRule(input: CanonCheckInput): CanonConflictHint[] {
  if (input.worldSlug !== "terra") {
    return [];
  }

  const haystack = [
    input.pageTitle ?? "",
    input.pageContent ?? "",
    input.context.title ?? "",
    input.context.levelSlug ?? "",
    input.context.dungeonSlug ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const mentionsTower = TERRA_ROUND_TOWER_KEYWORDS.some((keyword) => haystack.includes(keyword));
  const mentionsSquare =
    haystack.includes("eckig") ||
    haystack.includes("quadrat") ||
    haystack.includes("square") ||
    haystack.includes("rechteck");

  if (mentionsTower && mentionsSquare) {
    return [
      {
        code: "terra_round_tower",
        message:
          "Terra-Kanon: Magister-/Nepurga-Turm-Ebenen sind immer rund — eckige/quadratische Ebenen widersprechen dem Kanon.",
        severity: "error",
        suggestion: "Ebene als rund beschreiben oder als Idee/Nicht-Kanon kennzeichnen.",
      },
    ];
  }

  if (
    (input.context.kind === "dungeon_level" || input.context.kind === "room") &&
    mentionsTower &&
    haystack.includes("ebene")
  ) {
    return [
      {
        code: "terra_tower_level_hint",
        message: "Terra-Hinweis: Turm-Ebenen (Magister/Nepurga) sind im Kanon rund.",
        severity: "warn",
        suggestion: "Runde Ebenen-Geometrie in Beschreibung berücksichtigen.",
      },
    ];
  }

  return [];
}

export function checkDuplicateNames(duplicateTitles: string[] = []): CanonConflictHint[] {
  return duplicateTitles.map((title) => ({
    code: "duplicate_name",
    message: `Doppelter Name im Kontext: „${title}"`,
    severity: "warn",
    suggestion: "Eindeutige Benennung oder Alias nutzen.",
  }));
}

export function checkCanonOverwriteRisk(canonicalStatus?: string): CanonConflictHint[] {
  if (canonicalStatus === "canon") {
    return [
      {
        code: "canon_overwrite_risk",
        message: "Kanonisierter Inhalt — KI-Vorschläge dürfen Terra-/Welt-Kanon nicht still überschreiben.",
        severity: "warn",
        suggestion: "Änderungen nur als Review-Proposal prüfen, nicht automatisch übernehmen.",
      },
    ];
  }
  return [];
}

export function runCanonConflictChecks(input: CanonCheckInput): CanonConflictHint[] {
  return [
    ...checkTerraRoundTowerRule(input),
    ...checkDuplicateNames(input.duplicateTitles),
    ...checkCanonOverwriteRisk(input.canonicalStatus),
  ];
}
