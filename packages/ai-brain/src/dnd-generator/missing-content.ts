import type { DndContextDescriptor, MissingContentHint } from "./types";

export interface ContentSnapshot {
  title?: string | null;
  summary?: string | null;
  motivation?: string | null;
  secret?: string | null;
  description?: string | null;
  tactics?: string | null;
  enemies?: string | null;
  reward?: string | null;
  openPlots?: string | null;
  playerText?: string | null;
  readAloud?: string | null;
  dmNotes?: string | null;
}

function isEmpty(value: string | null | undefined): boolean {
  return !value?.trim();
}

export function detectMissingContent(
  context: DndContextDescriptor,
  content: ContentSnapshot,
): MissingContentHint[] {
  const hints: MissingContentHint[] = [];

  switch (context.kind) {
    case "npc":
      if (isEmpty(content.motivation)) {
        hints.push({
          field: "motivation",
          label: "NPC ohne Motivation",
          severity: "warn",
          suggestedActionId: "fill_missing",
        });
      }
      break;

    case "location":
      if (isEmpty(content.secret)) {
        hints.push({
          field: "secret",
          label: "Ort ohne Geheimnis",
          severity: "info",
          suggestedActionId: "fill_missing",
        });
      }
      break;

    case "room":
      if (isEmpty(content.description) && isEmpty(content.readAloud)) {
        hints.push({
          field: "description",
          label: "Raum ohne Beschreibung",
          severity: "warn",
          suggestedActionId: "fill_missing",
        });
      }
      if (isEmpty(content.dmNotes)) {
        hints.push({
          field: "dmNotes",
          label: "Raum ohne DM-Notizen",
          severity: "info",
          suggestedActionId: "dm_notes",
        });
      }
      break;

    case "encounter":
      if (isEmpty(content.enemies)) {
        hints.push({
          field: "enemies",
          label: "Encounter ohne Gegner",
          severity: "warn",
          suggestedActionId: "fill_missing",
        });
      }
      if (isEmpty(content.tactics)) {
        hints.push({
          field: "tactics",
          label: "Encounter ohne Taktik",
          severity: "warn",
          suggestedActionId: "fill_missing",
        });
      }
      break;

    case "quest":
      if (isEmpty(content.reward)) {
        hints.push({
          field: "reward",
          label: "Quest ohne Belohnung",
          severity: "info",
          suggestedActionId: "fill_missing",
        });
      }
      break;

    case "session":
      if (isEmpty(content.openPlots)) {
        hints.push({
          field: "openPlots",
          label: "Session ohne offene Plots",
          severity: "warn",
          suggestedActionId: "prepare_next_session",
        });
      }
      break;

    case "handout":
      if (isEmpty(content.playerText)) {
        hints.push({
          field: "playerText",
          label: "Handout ohne Spielerfassung",
          severity: "warn",
          suggestedActionId: "player_version",
        });
      }
      break;

    default:
      if (isEmpty(content.summary) && isEmpty(content.description)) {
        hints.push({
          field: "summary",
          label: "Inhalt ohne Zusammenfassung",
          severity: "info",
          suggestedActionId: "summarize",
        });
      }
      break;
  }

  return hints;
}
