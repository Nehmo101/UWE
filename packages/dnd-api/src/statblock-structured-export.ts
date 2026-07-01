function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function abilityModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function exportStructuredStatblockJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function exportStructuredStatblockFiveTools(data: unknown): string {
  const record = asRecord(data);
  if (!record) {
    return exportStructuredStatblockJson({ name: "Unbekannt", source: "uwe" });
  }

  const payload = {
    name: asString(record.name) || "Unbenannt",
    size: asString(record.size) || undefined,
    type: asString(record.type) || undefined,
    alignment: asString(record.alignment) || undefined,
    ac: record.ac ?? record.armor_class,
    hp: record.hp ?? record.hit_points,
    speed: record.speed,
    cr: record.cr ?? record.challenge_rating,
    abilities: record.abilities ?? {
      str: record.strength,
      dex: record.dexterity,
      con: record.constitution,
      int: record.intelligence,
      wis: record.wisdom,
      cha: record.charisma,
    },
    traits: record.traits ?? record.special_abilities,
    actions: record.actions,
    source: "uwe",
  };

  return JSON.stringify(payload, null, 2);
}

export function exportStructuredStatblockHomebrewery(data: unknown): string {
  const record = asRecord(data);
  if (!record) {
    return "> ## Unbekannt\n> Keine Statblock-Daten.";
  }

  const name = asString(record.name) || "Unbenannt";
  const size = asString(record.size);
  const type = asString(record.type);
  const alignment = asString(record.alignment);
  const cr = asString(record.cr) || asString(record.challenge_rating);
  const ac = record.ac ?? record.armor_class;
  const hp = record.hp ?? record.hit_points;

  const lines: string[] = [
    `> ## ${name}`,
    ">",
    `> *${[size, type, alignment].filter(Boolean).join(", ")}*`,
    ">",
    `> - **Rüstungsklasse** ${typeof ac === "object" ? JSON.stringify(ac) : ac ?? "—"}`,
    `> - **Trefferpunkte** ${typeof hp === "object" ? JSON.stringify(hp) : hp ?? "—"}`,
  ];

  if (cr) {
    lines.push(`> - **Herausforderungsgrad** ${cr}`);
  }

  const abilities = asRecord(record.abilities);
  if (abilities) {
    const abilityLine = ["str", "dex", "con", "int", "wis", "cha"]
      .map((key) => {
        const score = asNumber(abilities[key]);
        if (score == null) {
          return null;
        }
        return `${key.toUpperCase()} ${score} (${abilityModifier(score)})`;
      })
      .filter(Boolean)
      .join(", ");
    if (abilityLine) {
      lines.push(`> - **Attribute** ${abilityLine}`);
    }
  }

  const sections = [
    ["traits", "Eigenschaften"],
    ["actions", "Aktionen"],
    ["reactions", "Reaktionen"],
    ["legendary_actions", "Legendäre Aktionen"],
  ] as const;

  for (const [key, title] of sections) {
    const entries = record[key];
    if (!Array.isArray(entries) || entries.length === 0) {
      continue;
    }
    lines.push(">", `> ### ${title}`);
    for (const entry of entries) {
      const item = asRecord(entry);
      if (!item) {
        continue;
      }
      const entryName = asString(item.name) || title;
      const desc = asString(item.desc) || asString(item.description);
      lines.push(`> - ***${entryName}.*** ${desc}`.trim());
    }
  }

  lines.push(">", "> *Export via UWE Statblock Studio — SRD/Open5e-Attribution beachten.*");
  return lines.join("\n");
}
