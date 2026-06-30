import type { AiTaskType, ContextAudience } from "./types";

/** Curated UWE Brain cookbook actions (P09). */
export type BrainActionId =
  | "session_recap"
  | "next_session_prep"
  | "expand_knowledge"
  | "create_knowledge_text"
  | "canon_check"
  | "player_handout"
  | "fill_dungeon_room"
  | "mail_draft"
  | "atlas_name_regions";

export type AiProposalTargetType =
  | "session_summary_dm"
  | "session_summary_player"
  | "page_content_block"
  | "brain_document"
  | "idea_page"
  | "mail_draft"
  | "atlas_draft_names";

export interface BrainActionDefinition {
  id: BrainActionId;
  label: string;
  description: string;
  taskType: AiTaskType;
  requiresSession: boolean;
  playerSafe: boolean;
  audience: ContextAudience;
  defaultProposalTarget: AiProposalTargetType;
  defaultProposalLabel: string;
}

export const BRAIN_ACTIONS: Record<BrainActionId, BrainActionDefinition> = {
  session_recap: {
    id: "session_recap",
    label: "Session Recap erstellen",
    description: "Strukturierte DM-Zusammenfassung der Session als Vorschlag.",
    taskType: "summarize_session",
    requiresSession: true,
    playerSafe: false,
    audience: "dm_internal",
    defaultProposalTarget: "session_summary_dm",
    defaultProposalLabel: "Session-Recap (DM)",
  },
  next_session_prep: {
    id: "next_session_prep",
    label: "Nächste Session vorbereiten",
    description: "Agenda, Szenen und Vorbereitungshinweise für die nächste Runde.",
    taskType: "prepare_next_session",
    requiresSession: true,
    playerSafe: false,
    audience: "dm_internal",
    defaultProposalTarget: "page_content_block",
    defaultProposalLabel: "Session-Vorbereitung",
  },
  expand_knowledge: {
    id: "expand_knowledge",
    label: "Wissenstext erweitern",
    description: "Lore-Text verbessern und erweitern, ohne Kanon ungeprüft zu ändern.",
    taskType: "improve_lore_text",
    requiresSession: false,
    playerSafe: false,
    audience: "dm_internal",
    defaultProposalTarget: "page_content_block",
    defaultProposalLabel: "Erweiterter Lore-Text",
  },
  create_knowledge_text: {
    id: "create_knowledge_text",
    label: "Wissenstext erstellen",
    description:
      "Aus Kontext, Brain und Seite einen neuen strukturierten Wissenstext als Brain-Dokument vorschlagen.",
    taskType: "create_knowledge_text",
    requiresSession: false,
    playerSafe: false,
    audience: "dm_internal",
    defaultProposalTarget: "brain_document",
    defaultProposalLabel: "Wissenstext",
  },
  canon_check: {
    id: "canon_check",
    label: "Kanon-Konfliktprüfung",
    description: "Widersprüche und Kanon-Abweichungen im Kontext erkennen.",
    taskType: "prepare_canon_check",
    requiresSession: false,
    playerSafe: false,
    audience: "dm_internal",
    defaultProposalTarget: "idea_page",
    defaultProposalLabel: "Kanonprüfung",
  },
  player_handout: {
    id: "player_handout",
    label: "Spieler-Handout erstellen",
    description: "Spieler-sicheres Handout ohne GM-Geheimnisse.",
    taskType: "create_player_handout",
    requiresSession: false,
    playerSafe: true,
    audience: "player_visible",
    defaultProposalTarget: "brain_document",
    defaultProposalLabel: "Spieler-Handout",
  },
  fill_dungeon_room: {
    id: "fill_dungeon_room",
    label: "Dungeonraum füllen",
    description: "Raumbeschreibung, Interaktionen und GM-Notizen für Dungeon-Räume.",
    taskType: "fill_dungeon_room",
    requiresSession: false,
    playerSafe: false,
    audience: "dm_internal",
    defaultProposalTarget: "page_content_block",
    defaultProposalLabel: "Rauminhalt",
  },
  mail_draft: {
    id: "mail_draft",
    label: "Mail aus Recap/Handout vorbereiten",
    description: "Mail-Entwurf für Spieler — wird nicht automatisch versendet.",
    taskType: "prepare_mail_draft",
    requiresSession: true,
    playerSafe: true,
    audience: "mail",
    defaultProposalTarget: "mail_draft",
    defaultProposalLabel: "Mail-Entwurf",
  },
  atlas_name_regions: {
    id: "atlas_name_regions",
    label: "Atlas-Regionen benennen",
    description:
      "Schlägt stimmungsvolle Namen für Regionen, Gebirge, Wälder, Flüsse und Städte im Atlas-Entwurf vor. Nie automatisch in den Kanon.",
    taskType: "atlas_name_region",
    requiresSession: false,
    playerSafe: false,
    audience: "dm_internal",
    defaultProposalTarget: "atlas_draft_names",
    defaultProposalLabel: "Atlas-Namen Vorschläge",
  },
};

export const BRAIN_ACTION_LIST = Object.values(BRAIN_ACTIONS);

export function getBrainAction(actionId: BrainActionId): BrainActionDefinition {
  const action = BRAIN_ACTIONS[actionId];
  if (!action) {
    throw new Error(`Unbekannte Brain-Aktion: ${actionId}`);
  }
  return action;
}

export function isBrainActionId(value: string): value is BrainActionId {
  return value in BRAIN_ACTIONS;
}
