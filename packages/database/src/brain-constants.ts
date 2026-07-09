import type {
  BrainDocumentType,
  BrainSource,
  BrainStatus,
  BrainVisibility,
} from "./generated/prisma/client";

export const BRAIN_VISIBILITY_LABELS: Record<BrainVisibility, string> = {
  dm_only: "Nur GM",
  player_visible: "Spieler sichtbar",
  public: "Öffentlich",
};

export const BRAIN_STATUS_LABELS: Record<BrainStatus, string> = {
  draft: "Entwurf",
  reviewed: "Geprüft",
  canonical: "Kanon",
  deprecated: "Veraltet",
};

export const BRAIN_SOURCE_LABELS: Record<BrainSource, string> = {
  manual: "Manuell",
  ai_generated: "KI-generiert",
  import: "Importiert",
  session_summary: "Session-Zusammenfassung",
};

export const BRAIN_DOCUMENT_TYPE_LABELS: Record<BrainDocumentType, string> = {
  world_knowledge: "Weltwissen",
  campaign_knowledge: "Kampagnenwissen",
  session_summary: "Session-Zusammenfassung",
  npc_facts: "NPC-Fakten",
  location_facts: "Orts-Fakten",
  faction_facts: "Fraktions-Fakten",
  canon_facts: "Kanon-Fakten",
  general: "Allgemein",
  ai_summary: "KI-Zusammenfassung",
};
