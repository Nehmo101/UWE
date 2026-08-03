import type { JobType } from "./generated/prisma/client";

export type CampaignJobPresetKind = "job" | "brain_action";

export interface CampaignJobPreset {
  id: string;
  label: string;
  description: string;
  kind: CampaignJobPresetKind;
  /** For kind=job */
  jobType?: JobType;
  /** For kind=brain_action — maps to /api/brain/run actionId */
  brainActionId?: string;
  requiresSession?: boolean;
  requiresPage?: boolean;
  /** Link to dedicated UI when extra context is needed */
  href?: string;
}

/** One-click campaign job presets for the Studio job queue. */
export const CAMPAIGN_JOB_PRESETS: CampaignJobPreset[] = [
  {
    id: "inspector-canon-check",
    label: "Inspector Kanonprüfung",
    description: "Schnelle Welt-Analyse ohne KI — Sicherheits- und Kanon-Funde.",
    kind: "job",
    jobType: "canon_check",
  },
  {
    id: "brain-canon-check",
    label: "KI Kanon-Konfliktprüfung",
    description: "Widersprüche per Maschinenraum/Brain als Review-Vorschlag.",
    kind: "brain_action",
    brainActionId: "canon_check",
  },
  {
    id: "brain-next-session",
    label: "Nächste Session vorbereiten",
    description: "Session-Paket (Agenda, NPCs, Encounters) — Review vor Übernahme.",
    kind: "brain_action",
    brainActionId: "next_session_prep",
    requiresSession: true,
    href: "/worlds/{worldSlug}/prepare-session",
  },
  {
    id: "brain-session-recap",
    label: "Session Recap (DM)",
    description: "Strukturierte DM-Zusammenfassung der letzten Session.",
    kind: "brain_action",
    brainActionId: "session_recap",
    requiresSession: true,
  },
  {
    id: "brain-reindex",
    label: "Brain Reindex",
    description: "Embeddings für Brain-Dokumente der Welt neu berechnen.",
    kind: "job",
    jobType: "reindex",
  },
  {
    id: "brain-player-handout",
    label: "Spieler-Handout",
    description: "Spieler-sicheres Handout ohne GM-Geheimnisse.",
    kind: "brain_action",
    brainActionId: "player_handout",
    requiresPage: true,
  },
];

export function resolveCampaignPresetHref(
  preset: CampaignJobPreset,
  worldSlug: string,
): string | undefined {
  if (!preset.href) return undefined;
  return preset.href.replace("{worldSlug}", worldSlug);
}
