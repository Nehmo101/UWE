export interface EncounterDifficultyInput {
  partyLevel: number;
  partySize: number;
  desiredDifficulty: "easy" | "medium" | "hard" | "deadly";
  environment?: string;
  hasNonCombatOption?: boolean;
}

export interface EncounterPlan {
  enemies: string;
  behavior: string;
  terrain: string;
  scaling: string;
  loot: string;
  consequences: string;
  readAloud: string;
  dmNotes: string;
  alternativeSolutions: string[];
  escalation: string;
}

export function buildEncounterPromptHints(input: EncounterDifficultyInput): string[] {
  const hints = [
    `Party-Level: ${input.partyLevel}`,
    `Gruppengröße: ${input.partySize}`,
    `Gewünschte Schwierigkeit: ${input.desiredDifficulty}`,
  ];

  if (input.environment?.trim()) {
    hints.push(`Umgebung: ${input.environment.trim()}`);
  }

  if (input.hasNonCombatOption) {
    hints.push("Nichtkampf-Optionen und Eskalationspfade einplanen.");
  }

  return hints;
}

export function buildEncounterPlanOutline(input: EncounterDifficultyInput): EncounterPlan {
  const scaling =
    input.partySize > 4
      ? "Mehr Gegner oder erhöhte Trefferpunkte bei größerer Gruppe."
      : input.partySize < 4
        ? "Weniger Gegner oder reduzierte Trefferpunkte bei kleinerer Gruppe."
        : "Standard-Scaling für 4 Spieler.";

  return {
    enemies: `Gegner passend zu Level ${input.partyLevel} (${input.desiredDifficulty}).`,
    behavior: "Taktisches Verhalten mit Flanken, Deckung und Rückzugsoption.",
    terrain: input.environment?.trim() || "Terrain nutzt Höhenunterschiede und Engpässe.",
    scaling,
    loot: "Loot proportional zur Schwierigkeit und Session-Kontext.",
    consequences: "Sieg/Niederlage/Rückzug mit narrativen Folgen.",
    readAloud: "Vorlesetext für den Einstieg in die Szene.",
    dmNotes: "Initiative-Hinweise, versteckte Gefahren, DM-only Trigger.",
    alternativeSolutions: input.hasNonCombatOption
      ? ["Verhandlung", "Schleichen/Umgehung", "Rätsel/Lore-Lösung"]
      : ["Verhandlung unter Druck"],
    escalation: "Eskalation bei Lärm, Zeitdruck oder fehlgeschlagener Stealth.",
  };
}
