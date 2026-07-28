import type { AiTaskType } from "./types";

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
  | "atlas_name_regions"
  | "atlas_describe_region"
  | "atlas_fill_area"
  | "atlas_generate_asset_proposal";

export type AiProposalTargetType =
  | "session_summary_dm"
  | "session_summary_player"
  | "page_content_block"
  | "brain_document"
  | "idea_page"
  | "mail_draft"
  | "atlas_draft_names"
  | "atlas_region_description"
  | "atlas_plot_fill"
  | "atlas_asset_proposal";

export interface BrainActionDefinition {
  id: BrainActionId;
  label: string;
  description: string;
  taskType: AiTaskType;
  requiresSession: boolean;
  playerSafe: boolean;
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
    defaultProposalTarget: "atlas_draft_names",
    defaultProposalLabel: "Atlas-Namen Vorschläge",
  },
  atlas_describe_region: {
    id: "atlas_describe_region",
    label: "Region beschreiben",
    description:
      "Schreibt eine atmosphärische DM-Beschreibung für eine ausgewählte Kartenregion. Nie automatisch in den Kanon.",
    taskType: "atlas_describe_region",
    requiresSession: false,
    playerSafe: false,
    defaultProposalTarget: "atlas_region_description",
    defaultProposalLabel: "Regionsbeschreibung (Entwurf)",
  },
  atlas_fill_area: {
    id: "atlas_fill_area",
    label: "Atlas-Objektfläche füllen",
    description:
      "Schlägt ein sicheres Gouache-Scatter-Rezept für eine Atlas-Objektfläche vor. RTX liefert nur Parameter, nie fertige Kartenobjekte.",
    taskType: "atlas_fill_area",
    requiresSession: false,
    playerSafe: false,
    defaultProposalTarget: "atlas_plot_fill",
    defaultProposalLabel: "Atlas-Objektfläche (Rezept)",
  },
  atlas_generate_asset_proposal: {
    id: "atlas_generate_asset_proposal",
    label: "Atlas-Asset vorschlagen",
    description:
      "Schlägt ein sicheres Atlas-Gouache-Asset auf Basis des Styleguides vor. RTX liefert nur ein validierbares Asset-Proposal, nie Code.",
    taskType: "atlas_generate_asset_proposal",
    requiresSession: false,
    playerSafe: false,
    defaultProposalTarget: "atlas_asset_proposal",
    defaultProposalLabel: "Atlas-Asset-Proposal",
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
