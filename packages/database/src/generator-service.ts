import type { PageType } from "./generated/prisma/client";

export type GeneratorContextType =
  | "world"
  | "page"
  | "session"
  | "dungeon"
  | "dungeon_level"
  | "room"
  | "encounter"
  | "trap"
  | "puzzle"
  | "loot"
  | "handout"
  | "monster"
  | "rule"
  | "npc"
  | "location"
  | "faction"
  | "quest"
  | "item";

export type GeneratorActionId =
  | "fill_missing_fields"
  | "generate_dm_notes"
  | "generate_player_text"
  | "generate_handout"
  | "check_canon"
  | "prepare_next_session"
  | "generate_encounter"
  | "generate_read_aloud"
  | "remove_spoilers"
  | "simulate_faction"
  | "generate_npc"
  | "generate_quest"
  | "generate_item";

export interface GeneratorContext {
  contextType: GeneratorContextType;
  contextId: string;
  worldId?: string | null;
  worldSlug?: string | null;
  pageId?: string | null;
  pageType?: PageType | null;
  pageTitle?: string | null;
  parentContext?: GeneratorContextType | null;
}

export interface GeneratorActionDefinition {
  id: GeneratorActionId;
  label: string;
  description: string;
  requiresLocalRtx: boolean;
  reviewRequired: true;
}

export interface MissingContentHint {
  field: string;
  label: string;
  severity: "warning" | "info";
}

const PAGE_TYPE_TO_CONTEXT: Partial<Record<PageType, GeneratorContextType>> = {
  npc: "npc",
  location: "location",
  faction: "faction",
  quest: "quest",
  item: "item",
  session: "session",
  dungeon: "dungeon",
  dungeon_level: "dungeon_level",
  room: "room",
  encounter: "encounter",
  trap: "trap",
  puzzle: "puzzle",
  loot: "loot",
  handout: "handout",
  monster: "monster",
  rule: "rule",
};

const BASE_ACTIONS: GeneratorActionDefinition[] = [
  {
    id: "fill_missing_fields",
    label: "Fehlende Felder ergänzen",
    description: "Erkennt Lücken und schlägt gezielte Ergänzungen vor.",
    requiresLocalRtx: true,
    reviewRequired: true,
  },
  {
    id: "generate_dm_notes",
    label: "DM-Notizen erzeugen",
    description: "Erzeugt DM-only Notizen — Review vor Übernahme.",
    requiresLocalRtx: true,
    reviewRequired: true,
  },
  {
    id: "generate_player_text",
    label: "Spielertext erzeugen",
    description: "Player-safe Text ohne DM-only Leaks.",
    requiresLocalRtx: true,
    reviewRequired: true,
  },
  {
    id: "check_canon",
    label: "Kanon prüfen",
    description: "Prüft Konflikte mit Weltwissen und Terra-Regeln.",
    requiresLocalRtx: true,
    reviewRequired: true,
  },
];

const CONTEXT_ACTIONS: Partial<Record<GeneratorContextType, GeneratorActionId[]>> = {
  session: ["prepare_next_session", "fill_missing_fields", "check_canon"],
  room: ["generate_read_aloud", "fill_missing_fields", "generate_encounter"],
  encounter: ["generate_encounter", "fill_missing_fields"],
  handout: ["generate_handout", "remove_spoilers", "generate_player_text"],
  dungeon: ["prepare_next_session", "fill_missing_fields"],
  npc: ["generate_npc", "fill_missing_fields", "generate_dm_notes", "generate_player_text", "check_canon"],
  quest: ["generate_quest", "fill_missing_fields", "generate_player_text", "check_canon"],
  item: ["generate_item", "fill_missing_fields", "generate_player_text", "check_canon"],
  faction: ["simulate_faction", "fill_missing_fields", "generate_dm_notes", "check_canon"],
};

const ACTION_DEFINITIONS: Record<GeneratorActionId, GeneratorActionDefinition> = {
  fill_missing_fields: BASE_ACTIONS[0]!,
  generate_dm_notes: BASE_ACTIONS[1]!,
  generate_player_text: BASE_ACTIONS[2]!,
  check_canon: BASE_ACTIONS[3]!,
  generate_handout: {
    id: "generate_handout",
    label: "Handout erzeugen",
    description: "Erzeugt ein prüfbares Handout-Vorschlag.",
    requiresLocalRtx: true,
    reviewRequired: true,
  },
  prepare_next_session: {
    id: "prepare_next_session",
    label: "Nächste Session vorbereiten",
    description:
      "Regelbasierte Outline aus Session-Metadaten (ohne KI-Modell) — als Review-Vorschlag, nie automatisch übernehmen.",
    requiresLocalRtx: true,
    reviewRequired: true,
  },
  generate_encounter: {
    id: "generate_encounter",
    label: "Encounter vorschlagen",
    description: "Encounter mit Taktik, Scaling und Alternativen.",
    requiresLocalRtx: true,
    reviewRequired: true,
  },
  generate_read_aloud: {
    id: "generate_read_aloud",
    label: "Vorlesetext erzeugen",
    description: "Read-aloud Text für Dungeon-Räume.",
    requiresLocalRtx: true,
    reviewRequired: true,
  },
  remove_spoilers: {
    id: "remove_spoilers",
    label: "Spoiler entfernen",
    description: "Portal-sichere Version ohne DM-only Inhalte.",
    requiresLocalRtx: true,
    reviewRequired: true,
  },
  simulate_faction: {
    id: "simulate_faction",
    label: "Fraktion simulieren",
    description:
      "RTX-only: Schlägt datierte WorldEvents als Review-Vorschlag vor — nie automatisch übernehmen.",
    requiresLocalRtx: true,
    reviewRequired: true,
  },
  generate_npc: {
    id: "generate_npc",
    label: "NPC strukturiert generieren",
    description:
      "RTX-only: Stimme, Motivation, Beziehung und Plot-Nutzen als JSON-Vorschlag — Review vor Übernahme.",
    requiresLocalRtx: true,
    reviewRequired: true,
  },
  generate_quest: {
    id: "generate_quest",
    label: "Quest strukturiert generieren",
    description:
      "RTX-only: Auftraggeber, Ziel, Twist und Belohnung als JSON-Vorschlag — Review vor Übernahme.",
    requiresLocalRtx: true,
    reviewRequired: true,
  },
  generate_item: {
    id: "generate_item",
    label: "Item strukturiert generieren",
    description:
      "RTX-only: Eigenschaften, Seltenheit und Lore als JSON-Vorschlag — Review vor Übernahme.",
    requiresLocalRtx: true,
    reviewRequired: true,
  },
};

export function mapStructuredGeneratorAction(
  actionId: GeneratorActionId,
): "npc" | "quest" | "item" | null {
  if (actionId === "generate_npc") return "npc";
  if (actionId === "generate_quest") return "quest";
  if (actionId === "generate_item") return "item";
  return null;
}

export function resolveGeneratorContextFromPage(input: {
  pageId: string;
  pageType: PageType;
  pageTitle: string;
  worldId: string;
  worldSlug: string;
}): GeneratorContext {
  return {
    contextType: PAGE_TYPE_TO_CONTEXT[input.pageType] ?? "page",
    contextId: input.pageId,
    worldId: input.worldId,
    worldSlug: input.worldSlug,
    pageId: input.pageId,
    pageType: input.pageType,
    pageTitle: input.pageTitle,
  };
}

export function listGeneratorActions(context: GeneratorContext): GeneratorActionDefinition[] {
  const ids = new Set<GeneratorActionId>([
    "fill_missing_fields",
    "generate_dm_notes",
    "generate_player_text",
    "check_canon",
  ]);

  const extra = CONTEXT_ACTIONS[context.contextType] ?? [];
  for (const id of extra) {
    ids.add(id);
  }

  return [...ids].map((id) => ACTION_DEFINITIONS[id]);
}

export function detectMissingContent(input: {
  pageType: PageType;
  summary?: string | null;
  contentBlocks?: Array<{ type: string; content?: string | null; visibility?: string }>;
  prepStatus?: string | null;
}): MissingContentHint[] {
  const hints: MissingContentHint[] = [];
  const hasBlock = (type: string) =>
    input.contentBlocks?.some((block) => block.type === type && block.content?.trim());

  switch (input.pageType) {
    case "npc":
      if (!input.summary?.trim()) {
        hints.push({ field: "summary", label: "Motivation/Kurzbeschreibung", severity: "warning" });
      }
      if (!hasBlock("gm_note")) {
        hints.push({ field: "gm_note", label: "DM-Notizen", severity: "info" });
      }
      break;
    case "location":
      if (!hasBlock("player_text")) {
        hints.push({ field: "player_text", label: "Spielertext", severity: "warning" });
      }
      if (!hasBlock("gm_note")) {
        hints.push({ field: "gm_note", label: "Geheimnis", severity: "info" });
      }
      break;
    case "room":
      if (!hasBlock("player_text")) {
        hints.push({ field: "player_text", label: "Vorlesetext", severity: "warning" });
      }
      if (input.prepStatus === "unprepared") {
        hints.push({ field: "prepStatus", label: "Prep-Status", severity: "info" });
      }
      break;
    case "encounter":
      if (!hasBlock("statblock") && !hasBlock("gm_note")) {
        hints.push({ field: "encounter", label: "Gegner/Taktik", severity: "warning" });
      }
      break;
    case "quest":
      if (!hasBlock("gm_note")) {
        hints.push({ field: "reward", label: "Belohnung", severity: "warning" });
      }
      break;
    case "session":
      if (!input.summary?.trim()) {
        hints.push({ field: "openPlots", label: "Offene Plots", severity: "warning" });
      }
      break;
    case "handout":
      if (!hasBlock("player_text")) {
        hints.push({ field: "player_text", label: "Spielerfassung", severity: "warning" });
      }
      break;
    default:
      if (!input.summary?.trim()) {
        hints.push({ field: "summary", label: "Zusammenfassung", severity: "info" });
      }
  }

  return hints;
}

export const DEFAULT_GENERATOR_PRESETS: Array<{
  name: string;
  targetType: string;
  description: string;
  template: Record<string, unknown>;
}> = [
  {
    name: "NPC Schnell",
    targetType: "npc",
    description: "Basis-NPC mit Motivation und Geheimnis",
    template: {
      structured: true,
      fields: ["voice", "motivation", "relationship", "plotHook", "secret"],
    },
  },
  {
    name: "Quest Schnell",
    targetType: "quest",
    description: "Quest mit Auftraggeber, Twist und Belohnung",
    template: {
      structured: true,
      fields: ["patron", "objective", "twist", "failure", "reward"],
    },
  },
  {
    name: "Item Schnell",
    targetType: "item",
    description: "Magischer Gegenstand mit Eigenschaften und Lore",
    template: {
      structured: true,
      fields: ["rarity", "properties", "value", "curse", "lore"],
    },
  },
  {
    name: "Magische Waffe",
    targetType: "item",
    description: "Waffe auf SRD-Basis mit Seltenheit und Einstimmung",
    template: {
      structured: true,
      fields: ["srdBase", "rarity", "attunement", "properties", "lore"],
      defaults: { rarity: "selten" },
    },
  },
  {
    name: "Wundersamer Gegenstand",
    targetType: "item",
    description: "Wondrous Item mit Einstimmung, Wert und Lore",
    template: {
      structured: true,
      fields: ["rarity", "attunement", "properties", "value", "lore"],
      defaults: { rarity: "ungewöhnlich" },
    },
  },
  {
    name: "Verfluchtes Relikt",
    targetType: "item",
    description: "Relikt auf SRD-Basis mit Fluch und dunkler Herkunft",
    template: {
      structured: true,
      fields: ["srdBase", "rarity", "attunement", "properties", "curse", "lore"],
      defaults: {
        rarity: "sehr selten",
        curse: "Der Fluch zeigt sich erst nach der Einstimmung.",
      },
    },
  },
  {
    name: "Ort Schnell",
    targetType: "location",
    description: "Ort mit Geheimnis und Spielertext",
    template: { fields: ["atmosphere", "secret", "player_text"] },
  },
  {
    name: "Dungeon-Raum",
    targetType: "room",
    description: "Raum mit Vorlesetext und DM-Notizen",
    template: { fields: ["read_aloud", "dm_notes", "features"] },
  },
  {
    name: "Encounter",
    targetType: "encounter",
    description: "Encounter mit Taktik und Loot",
    template: { fields: ["enemies", "tactics", "loot", "scaling"] },
  },
  {
    name: "Session Prep",
    targetType: "session",
    description: "Prepare-for-next-session Paket",
    template: {
      sections: [
        "recap",
        "open_plots",
        "npcs",
        "locations",
        "encounters",
        "handouts",
        "canon_warnings",
      ],
    },
  },
];
