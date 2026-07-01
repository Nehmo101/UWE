import type { GeneratorActionId } from "@uwe/database/server";
import type { AiTaskType } from "@uwe/ai-brain";
import {
  buildStructuredGeneratorPrompt,
  getStructuredGeneratorSchema,
  mapStructuredGeneratorAction,
} from "@uwe/database/server";

const GENERATOR_ACTION_TASK_MAP: Record<GeneratorActionId, AiTaskType> = {
  fill_missing_fields: "improve_lore_text",
  generate_dm_notes: "improve_lore_text",
  generate_player_text: "create_player_handout",
  generate_handout: "create_player_handout",
  check_canon: "detect_contradictions",
  prepare_next_session: "prepare_next_session",
  generate_encounter: "create_encounter",
  generate_read_aloud: "fill_dungeon_room",
  remove_spoilers: "generate_player_recap",
  simulate_faction: "simulate_faction",
  generate_npc: "generate_structured_npc",
  generate_quest: "generate_structured_quest",
  generate_item: "generate_structured_item",
};

export function mapGeneratorActionToTaskType(actionId: GeneratorActionId): AiTaskType {
  return GENERATOR_ACTION_TASK_MAP[actionId];
}

export function buildGeneratorUserPrompt(
  actionId: GeneratorActionId,
  pageTitle: string,
  structuredInput?: Record<string, string>,
): string {
  const structuredTarget = mapStructuredGeneratorAction(actionId);
  if (structuredTarget) {
    const schema = getStructuredGeneratorSchema(structuredTarget);
    return buildStructuredGeneratorPrompt(schema, pageTitle, structuredInput ?? {});
  }

  switch (actionId) {
    case "fill_missing_fields":
      return `Ergänze fehlende Felder für „${pageTitle}“. Nur Vorschläge — keine automatische Übernahme.`;
    case "generate_dm_notes":
      return `Erzeuge DM-only Notizen für „${pageTitle}".`;
    case "generate_player_text":
      return `Erzeuge einen player-safe Text für „${pageTitle}" ohne DM-only Leaks.`;
    case "generate_handout":
      return `Erzeuge ein Handout für „${pageTitle}".`;
    case "check_canon":
      return `Prüfe Kanon-Konflikte für „${pageTitle}" gegen Weltwissen.`;
    case "prepare_next_session":
      return `Bereite ein Session-Paket für „${pageTitle}" vor (Recap, Plots, NPCs, Encounters).`;
    case "generate_encounter":
      return `Schlage einen Encounter für „${pageTitle}" mit Taktik und Alternativen vor.`;
    case "generate_read_aloud":
      return `Erzeuge einen Vorlesetext (read-aloud) für „${pageTitle}".`;
    case "remove_spoilers":
      return `Entferne Spoiler und DM-only Inhalte aus „${pageTitle}" für Portal-Nutzung.`;
    case "simulate_faction":
      return `Simuliere einen Zeitsprung für die Fraktion „${pageTitle}": strukturierte JSON-Events mit In-Game-Datum für die Chronik.`;
    default:
      return `KI-Aktion für „${pageTitle}".`;
  }
}
