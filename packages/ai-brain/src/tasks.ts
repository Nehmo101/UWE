import type { AiContext, AiTaskType } from "./types";

export const AI_TASK_LABELS: Record<AiTaskType, string> = {
  summarize_page: "Seite zusammenfassen",
  summarize_session: "Session zusammenfassen",
  suggest_links: "Links vorschlagen",
  detect_contradictions: "Widersprüche erkennen",
  generate_player_recap: "Spieler-Recap erstellen",
  generate_dm_notes: "DM-Notizen generieren",
  create_npc: "NPC erstellen",
  create_location: "Ort erstellen",
  create_encounter: "Encounter erstellen",
  improve_lore_text: "Lore-Text verbessern",
};

const TASK_INSTRUCTIONS: Record<AiTaskType, string> = {
  summarize_page:
    "Fasse die Seite prägnant für den Spielleiter zusammen. Behalte wichtige Fakten und offene Hooks bei.",
  summarize_session:
    "Fasse die Session-Inhalte strukturiert zusammen: Ereignisse, NPCs, Orte, offene Plotstränge.",
  suggest_links:
    "Schlage sinnvolle Wikilinks zu bestehenden Seiten vor. Nenne Zielseiten mit ID und Begründung.",
  detect_contradictions:
    "Prüfe den Kontext auf Widersprüche zum Kanon. Liste konkrete Konflikte mit Quellen-IDs auf.",
  generate_player_recap:
    "Schreibe ein spielerfreundliches Recap ohne GM-Geheimnisse. Keine DM-only-Informationen.",
  generate_dm_notes:
    "Erstelle strukturierte DM-Notizen: Geheimnisse, Motivationen, mögliche Szenen, Warnhinweise.",
  create_npc:
    "Entwirf einen neuen NPC passend zum Setting. Gib Name, Rolle, Motivation, Hooks und Spielhinweise.",
  create_location:
    "Entwirf einen neuen Ort passend zum Setting. Beschreibe Atmosphäre, NPCs, Geheimnisse und Abenteuer-Hooks.",
  create_encounter:
    "Entwirf ein Encounter-Szenario mit Setup, Gegnern/Irritationen, Taktik und möglichen Ausgängen.",
  improve_lore_text:
    "Verbessere den Lore-Text stilistisch und strukturell, ohne Kanon-Fakten zu verändern.",
};

export function buildTaskPrompt(taskType: AiTaskType, context: AiContext, userPrompt?: string): string {
  const instruction = TASK_INSTRUCTIONS[taskType];
  const parts = [
    `Aufgabe: ${AI_TASK_LABELS[taskType]}`,
    instruction,
    "",
    "Kampagnen-Kontext:",
    context.promptContext,
    "",
    "Quellen:",
    ...context.sources.map((s) => `- Seite ${s.pageId}${s.blockIds?.length ? ` (Blöcke: ${s.blockIds.join(", ")})` : ""}`),
  ];

  if (userPrompt?.trim()) {
    parts.push("", "Zusätzliche Anweisung:", userPrompt.trim());
  }

  parts.push(
    "",
    "Wichtig: Erfinde keine Fakten ohne Kennzeichnung. Markiere Vorschläge klar als Idee, nicht als Kanon.",
  );

  return parts.join("\n");
}

export function buildTaskSystemPrompt(taskType: AiTaskType): string {
  return [
    "Du bist der AI-Assistent des Universellen Welten-Editors (UWE) für Pen-&-Paper-Kampagnen.",
    `Aktuelle Aufgabe: ${AI_TASK_LABELS[taskType]}.`,
    "Antworte auf Deutsch, präzise und für Tabletop-RPGs nutzbar.",
    "Verwende die mitgelieferten Quellen-IDs, wenn du dich auf Inhalte beziehst.",
  ].join(" ");
}
