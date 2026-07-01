import type { InGameDate } from "./world-calendar-service";

export interface FactionSimulationStateSnapshot {
  agenda?: string | null;
  powerLevel?: number | null;
  goals?: unknown;
  resources?: unknown;
  relationships?: unknown;
  notes?: string | null;
}

export interface FactionSimulationPromptInput {
  pageTitle: string;
  currentDateLabel: string;
  currentDate: InGameDate;
  calendarName?: string;
  factionState?: FactionSimulationStateSnapshot | null;
  structuredInput?: Record<string, string>;
}

function formatJsonSnapshot(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseTimeSkipDays(structuredInput?: Record<string, string>): number | null {
  const raw = structuredInput?.timeSkipDays?.trim();
  if (!raw) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function buildFactionSimulationPrompt(input: FactionSimulationPromptInput): string {
  const lines: string[] = [
    `Simuliere einen Zeitsprung für die Fraktion „${input.pageTitle}".`,
    "Antworte NUR als JSON-Objekt {\"events\":[...]} — jedes Event mit title, inGameDate {year,month,day}, summaryPlayer, summaryDm (optional), visibility (player_visible|private|dm_only).",
    "Keine Kanon-Änderungen — nur Vorschläge für die Welt-Chronik.",
    "",
    "Aktuelles In-Game-Datum:",
    `- ${input.currentDateLabel} (${input.currentDate.year}-${input.currentDate.month}-${input.currentDate.day})`,
  ];

  if (input.calendarName?.trim()) {
    lines.push(`- Kalender: ${input.calendarName.trim()}`);
  }

  const timeSkipDays = parseTimeSkipDays(input.structuredInput);
  if (timeSkipDays !== null) {
    lines.push("", `Zeitsprung: ca. ${timeSkipDays} In-Game-Tage ab dem aktuellen Datum.`);
  }

  const scenarioNote = input.structuredInput?.scenarioNote?.trim();
  if (scenarioNote) {
    lines.push("", "Fokus / Szenario:", scenarioNote);
  }

  const state = input.factionState;
  if (state) {
    lines.push("", "Fraktions-State (strukturiert):");
    if (state.agenda?.trim()) {
      lines.push(`- Agenda: ${state.agenda.trim()}`);
    }
    if (typeof state.powerLevel === "number") {
      lines.push(`- Machtstufe: ${state.powerLevel}/10`);
    }
    const goals = formatJsonSnapshot(state.goals);
    if (goals) {
      lines.push("- Ziele (JSON):", goals);
    }
    const resources = formatJsonSnapshot(state.resources);
    if (resources) {
      lines.push("- Ressourcen (JSON):", resources);
    }
    const relationships = formatJsonSnapshot(state.relationships);
    if (relationships) {
      lines.push("- Beziehungen (JSON):", relationships);
    }
    if (state.notes?.trim()) {
      lines.push(`- Notizen: ${state.notes.trim()}`);
    }
  } else {
    lines.push(
      "",
      "Hinweis: Kein strukturierter Fraktions-State hinterlegt — leite plausible Entwicklungen aus Wiki-Inhalten ab.",
    );
  }

  return lines.join("\n");
}

export function summarizeFactionStateForUi(
  state: FactionSimulationStateSnapshot | null | undefined,
): string[] {
  if (!state) {
    return ["Noch kein Fraktions-State gespeichert — Simulation nutzt Wiki-Kontext."];
  }

  const lines: string[] = [];
  if (state.agenda?.trim()) {
    lines.push(`Agenda: ${state.agenda.trim()}`);
  }
  if (typeof state.powerLevel === "number") {
    lines.push(`Machtstufe: ${state.powerLevel}/10`);
  }
  if (state.goals !== null && state.goals !== undefined) {
    lines.push("Ziele hinterlegt");
  }
  if (state.resources !== null && state.resources !== undefined) {
    lines.push("Ressourcen hinterlegt");
  }
  if (state.relationships !== null && state.relationships !== undefined) {
    lines.push("Beziehungen hinterlegt");
  }
  if (state.notes?.trim()) {
    lines.push(`Notizen: ${state.notes.trim().slice(0, 120)}${state.notes.trim().length > 120 ? "…" : ""}`);
  }
  return lines.length > 0 ? lines : ["Fraktions-State gespeichert (ohne ausgefüllte Felder)."];
}
