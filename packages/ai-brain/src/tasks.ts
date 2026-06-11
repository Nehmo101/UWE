import type { AiContext, AiTaskType } from "./types";

export const AI_TASK_LABELS: Record<AiTaskType, string> = {
  summarize_page: "Seite zusammenfassen",
  summarize_session: "Session zusammenfassen",
  generate_player_recap: "Spieler-Recap erstellen",
  suggest_links: "Links vorschlagen",
  suggest_backlinks: "Backlinks vorschlagen",
  detect_contradictions: "Widersprüche erkennen",
  find_open_threads: "Offene Plots erkennen",
  create_npc: "NPC-Ideen erstellen",
  create_location: "Orte erstellen",
  create_encounter: "Encounter erstellen",
  improve_lore_text: "Lore verbessern",
  prepare_canon_check: "Kanonprüfung vorbereiten",
};

const TASK_INSTRUCTIONS: Record<AiTaskType, string> = {
  summarize_page:
    "Fasse die Seite prägnant für den Spielleiter zusammen. Behalte wichtige Fakten und offene Hooks bei.",
  summarize_session:
    "Fasse die Session-Inhalte strukturiert zusammen: Ereignisse, NPCs, Orte, offene Plotstränge. Nutze Session-Daten und verknüpfte Seiten.",
  generate_player_recap:
    "Schreibe ein spielerfreundliches Recap ohne GM-Geheimnisse. Keine DM-only-Informationen, keine versteckten Motivationen oder Plot-Twists.",
  suggest_links:
    "Schlage sinnvolle ausgehende Wikilinks zu bestehenden Seiten vor. Nenne Zielseiten mit ID und Begründung.",
  suggest_backlinks:
    "Schlage Seiten vor, die auf die aktuelle Seite verlinken sollten (eingehende Backlinks). Nenne Quellseiten mit ID und Begründung.",
  detect_contradictions:
    "Prüfe den Kontext auf Widersprüche zum Kanon. Liste konkrete Konflikte mit Quellen-IDs auf.",
  find_open_threads:
    "Erkenne offene Plotstränge, ungelöste Hooks und angedeutete Ereignisse. Priorisiere nach Dringlichkeit.",
  create_npc:
    "Entwirf einen neuen NPC passend zum Setting. Gib Name, Rolle, Motivation, Hooks und Spielhinweise.",
  create_location:
    "Entwirf einen neuen Ort passend zum Setting. Beschreibe Atmosphäre, NPCs, Geheimnisse und Abenteuer-Hooks.",
  create_encounter:
    "Entwirf ein Encounter-Szenario mit Setup, Gegnern/Irritationen, Taktik und möglichen Ausgängen.",
  improve_lore_text:
    "Verbessere den Lore-Text stilistisch und strukturell, ohne Kanon-Fakten zu verändern.",
  prepare_canon_check:
    "Bereite eine Kanonprüfung vor: Liste Abweichungen, fehlende Quellen, widersprüchliche Aussagen und Empfehlungen zur Kanonisierung.",
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
    ...context.sources.map(
      (s) =>
        `- Seite ${s.pageId}${s.blockIds?.length ? ` (Blöcke: ${s.blockIds.join(", ")})` : ""}`,
    ),
  ];

  if (context.sessionId) {
    parts.push("", `Session-ID: ${context.sessionId}`);
  }

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
  const extra =
    taskType === "generate_player_recap"
      ? " Enthülle niemals GM-Geheimnisse, DM-only-Inhalte oder versteckte Plot-Twists."
      : "";

  return [
    "Du bist der AI-Assistent des Universellen Welten-Editors (UWE) für Pen-&-Paper-Kampagnen.",
    `Aktuelle Aufgabe: ${AI_TASK_LABELS[taskType]}.`,
    "Antworte auf Deutsch, präzise und für Tabletop-RPGs nutzbar.",
    "Verwende die mitgelieferten Quellen-IDs, wenn du dich auf Inhalte beziehst.",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}
