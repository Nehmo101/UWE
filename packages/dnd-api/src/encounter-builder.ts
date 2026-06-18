export interface EncounterMonsterInput {
  name: string;
  cr?: string;
  slug: string;
}

export function buildEncounterMarkdown(monsters: EncounterMonsterInput[]): string {
  if (monsters.length === 0) {
    return "# Encounter\n\nKeine Monster ausgewählt.";
  }

  const lines: string[] = ["# Encounter", "", "## Monster", ""];

  for (const monster of monsters) {
    const crLabel = monster.cr ? ` (CR ${monster.cr})` : "";
    lines.push(`- **${monster.name}**${crLabel} — \`${monster.slug}\``);
  }

  lines.push("", "## Notizen", "", "_Encounter-Notizen hier ergänzen…_");

  return lines.join("\n");
}
