import {
  ENCOUNTER_DIFFICULTY_LABELS,
  type EncounterXpAnalysis,
} from "./encounter-xp-budget";

export interface EncounterMonsterInput {
  name: string;
  cr?: string;
  slug: string;
  count?: number;
}

export function buildEncounterMarkdown(
  monsters: EncounterMonsterInput[],
  analysis?: EncounterXpAnalysis,
): string {
  if (monsters.length === 0) {
    return "# Encounter\n\nKeine Monster ausgewählt.";
  }

  const lines: string[] = ["# Encounter", "", "## Monster", ""];

  for (const monster of monsters) {
    const crLabel = monster.cr ? ` (CR ${monster.cr})` : "";
    const countLabel = monster.count && monster.count > 1 ? `${monster.count}× ` : "";
    lines.push(`- ${countLabel}**${monster.name}**${crLabel} — \`${monster.slug}\``);
  }

  if (analysis) {
    lines.push(
      "",
      "## XP-Budget",
      "",
      `- Schwierigkeit: **${ENCOUNTER_DIFFICULTY_LABELS[analysis.difficulty]}** (Party: ${analysis.partySize} × Level ${analysis.partyLevel})`,
      `- XP roh: ${analysis.rawXp} · angepasst (×${analysis.multiplier}): ${analysis.adjustedXp}`,
      `- Schwellen: leicht ${analysis.thresholds.easy} / mittel ${analysis.thresholds.medium} / schwer ${analysis.thresholds.hard} / tödlich ${analysis.thresholds.deadly}`,
    );
  }

  lines.push("", "## Taktik & Notizen", "", "_Encounter-Notizen hier ergänzen…_");

  return lines.join("\n");
}
