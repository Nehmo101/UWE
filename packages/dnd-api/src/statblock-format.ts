function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatAbilityScores(monster: Record<string, unknown>): string | null {
  const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
  const labels = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  const parts = abilities.map((key, index) => {
    const score = asNumber(monster[key]);
    if (score == null) return null;
    const mod = Math.floor((score - 10) / 2);
    const modLabel = mod >= 0 ? `+${mod}` : `${mod}`;
    return `${labels[index]} ${score} (${modLabel})`;
  }).filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

function formatSpeed(speed: unknown): string | null {
  const record = asRecord(speed);
  if (!record) {
    return asString(speed);
  }

  const parts = Object.entries(record)
    .map(([key, value]) => {
      if (value == null || value === false) return null;
      if (value === true) return key;
      return `${key} ${value} ft.`;
    })
    .filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

function formatNamedEntries(title: string, entries: unknown): string[] {
  const lines: string[] = [];
  for (const entry of asArray(entries)) {
    const record = asRecord(entry);
    if (!record) continue;
    const name = asString(record.name);
    const desc = asString(record.desc) ?? asString(record.description);
    if (!name && !desc) continue;
    lines.push(`**${name ?? title}.** ${desc ?? ""}`.trim());
  }
  return lines;
}

export function formatOpen5eMonsterAsMarkdown(monster: unknown): string {
  const data = asRecord(monster);
  if (!data) {
    return "# Unbekanntes Monster\n\nKeine Statblock-Daten.";
  }

  const name = asString(data.name) ?? "Unbekanntes Monster";
  const size = asString(data.size);
  const type = asString(data.type);
  const subtype = asString(data.subtype);
  const alignment = asString(data.alignment);
  const typeLine = [size, type, subtype ? `(${subtype})` : null, alignment].filter(Boolean).join(" ");

  const lines: string[] = [`# ${name}`, ""];

  if (typeLine) {
    lines.push(`*${typeLine}*`, "");
  }

  const armorClass = data.armor_class ?? data.armorClass;
  const hitPoints = data.hit_points ?? data.hitPoints;
  const hitDice = asString(data.hit_dice) ?? asString(data.hitDice);
  const challengeRating = asString(data.challenge_rating) ?? asString(data.challengeRating);
  const speed = formatSpeed(data.speed);

  if (armorClass != null) lines.push(`**Rüstungsklasse** ${String(armorClass)}`);
  if (hitPoints != null) {
    lines.push(`**Trefferpunkte** ${String(hitPoints)}${hitDice ? ` (${hitDice})` : ""}`);
  }
  if (speed) lines.push(`**Geschwindigkeit** ${speed}`);
  if (challengeRating) lines.push(`**CR** ${challengeRating}`);

  const abilities = formatAbilityScores(data);
  if (abilities) {
    lines.push("", abilities);
  }

  const sections: Array<[string, unknown]> = [
    ["Besondere Fähigkeiten", data.special_abilities ?? data.specialAbilities ?? data.traits],
    ["Aktionen", data.actions],
    ["Bonusaktionen", data.bonus_actions ?? data.bonusActions],
    ["Reaktionen", data.reactions],
    ["Legendäre Aktionen", data.legendary_actions ?? data.legendaryActions],
  ];

  for (const [title, entries] of sections) {
    const formatted = formatNamedEntries(title, entries);
    if (formatted.length === 0) continue;
    lines.push("", `## ${title}`, "", ...formatted);
  }

  const description = asString(data.desc) ?? asString(data.description);
  if (description) {
    lines.push("", description);
  }

  return lines.join("\n").trim();
}
