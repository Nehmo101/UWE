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
  | "campaign_chapter_draft"
  | "campaign_session_hooks"
  | "terra_name_regions"
  | "terra_describe_region"
  | "terra_world_draft";

export type AiProposalTargetType =
  | "session_summary_dm"
  | "session_summary_player"
  | "page_content_block"
  | "brain_document"
  | "idea_page"
  | "mail_draft"
  | "campaign_chapter_page"
  | "session_open_plots"
  | "terra_region_names"
  | "terra_region_description"
  | "terra_world_draft";

export interface BrainActionDefinition {
  id: BrainActionId;
  label: string;
  description: string;
  taskType: AiTaskType;
  requiresSession: boolean;
  /** Kampagnen-Aktionen laufen nur mit campaignSlug — der Runner erzwingt es. */
  requiresCampaign?: boolean;
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
  /* Kampagnen-Cockpit-Aktionen: laufen über den Kompakt-Digest der Kampagne
     (extraPromptContext aus @uwe/campaign-cockpit) statt über eine einzelne
     Seite. Der Digest enthält DM-Material (Fraktions-Agenden, summaryDm der
     Chronik) — beide Aktionen sind deshalb NIE playerSafe. */
  campaign_chapter_draft: {
    id: "campaign_chapter_draft",
    label: "Kapitel-Entwurf aus offenen Fäden",
    description:
      "Schlägt das nächste Kapitel der Kampagne vor — aus offenen Quests, jüngster Chronik und Fraktions-Agenden. Wird beim Übernehmen als unvorbereitete Kapitel-Seite angelegt.",
    taskType: "draft_campaign_chapter",
    requiresSession: false,
    requiresCampaign: true,
    playerSafe: false,
    defaultProposalTarget: "campaign_chapter_page",
    defaultProposalLabel: "Kapitel-Entwurf",
  },
  campaign_session_hooks: {
    id: "campaign_session_hooks",
    label: "Session-Aufhänger aus der Chronik",
    description:
      "3–5 konkrete Einstiegs-Hooks für den nächsten Spielabend. Landen beim Übernehmen in den offenen Plots der nächsten geplanten Session.",
    taskType: "suggest_session_hooks",
    requiresSession: false,
    requiresCampaign: true,
    playerSafe: false,
    defaultProposalTarget: "session_open_plots",
    defaultProposalLabel: "Session-Aufhänger",
  },
  /* The two surviving map text actions. They produce PROSE, not data — no
     validator, no JSON: a list of name suggestions and a description are read
     by a human and copied by hand. That is also why they need no bridge into
     the Terra frame and could be revived after Atlas went: nothing in their
     contract ever touched an Atlas table. */
  terra_name_regions: {
    id: "terra_name_regions",
    label: "Regionen benennen",
    description:
      "Schlägt stimmungsvolle Namen für Regionen, Gebirge, Wälder, Flüsse und Orte einer Terra-Karte vor. Nie automatisch in den Kanon.",
    taskType: "terra_name_regions",
    requiresSession: false,
    playerSafe: false,
    defaultProposalTarget: "terra_region_names",
    defaultProposalLabel: "Namensvorschläge zur Karte",
  },
  terra_describe_region: {
    id: "terra_describe_region",
    label: "Region beschreiben",
    description:
      "Schreibt eine atmosphärische DM-Beschreibung für einen Ausschnitt der Karte. Nie automatisch in den Kanon.",
    taskType: "terra_describe_region",
    requiresSession: false,
    playerSafe: false,
    defaultProposalTarget: "terra_region_description",
    defaultProposalLabel: "Regionsbeschreibung (Entwurf)",
  },
  terra_world_draft: {
    id: "terra_world_draft",
    label: "Terra-Karte beschreiben",
    description:
      "Übersetzt eine Beschreibung („Raue Küstenregion, drei Fischerdörfer …“) in Parameter für Terras deterministischen Weltgenerator. Das Modell liefert nur Parameter und Namen, nie Geometrie.",
    taskType: "terra_world_draft",
    requiresSession: false,
    playerSafe: false,
    defaultProposalTarget: "terra_world_draft",
    defaultProposalLabel: "Terra-Kartenentwurf (Parameter)",
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
