function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

export type Open5eEquipmentKind = "weapon" | "magicitem";

export function summarizeOpen5eEquipment(
  kind: Open5eEquipmentKind,
  raw: unknown,
): string | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;

  if (kind === "weapon") {
    const parts = [
      asString(record.category),
      record.damage_dice && record.damage_type
        ? `${record.damage_dice} ${record.damage_type}`
        : null,
      asString(record.cost),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }

  const parts = [
    asString(record.type),
    asString(record.rarity),
    record.requires_attunement ? "Attunement" : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function formatOpen5eEquipmentAsMarkdown(
  kind: Open5eEquipmentKind,
  raw: unknown,
): string {
  const record = asRecord(raw);
  if (!record) return "";

  const name = asString(record.name) ?? "Gegenstand";
  const lines = [`## ${name}`];

  if (kind === "weapon") {
    const stats = [
      asString(record.category) ? `**Kategorie:** ${record.category}` : null,
      asString(record.cost) ? `**Kosten:** ${record.cost}` : null,
      record.damage_dice && record.damage_type
        ? `**Schaden:** ${record.damage_dice} ${record.damage_type}`
        : null,
      asString(record.weight) ? `**Gewicht:** ${record.weight}` : null,
    ].filter((line): line is string => Boolean(line));
    lines.push(...stats);

    const properties = asStringArray(record.properties);
    if (properties.length > 0) {
      lines.push(`**Eigenschaften:** ${properties.join(", ")}`);
    }
  } else {
    const meta = [
      asString(record.type) ? `**Typ:** ${record.type}` : null,
      asString(record.rarity) ? `**Seltenheit:** ${record.rarity}` : null,
      record.requires_attunement
        ? "**Attunement:** erforderlich"
        : null,
    ].filter((line): line is string => Boolean(line));
    lines.push(...meta);

    const desc = asString(record.desc);
    if (desc) {
      lines.push("", desc);
    }
  }

  return lines.join("\n\n");
}

export function formatDnd5eSrdEquipmentAsMarkdown(raw: unknown): string {
  const record = asRecord(raw);
  if (!record) return "";

  const name = asString(record.name) ?? "Gegenstand";
  const lines = [`## ${name}`];

  const category = asRecord(record.equipment_category);
  if (category?.name) {
    lines.push(`**Kategorie:** ${category.name}`);
  }

  const cost = asRecord(record.cost);
  if (cost?.quantity != null && cost.unit) {
    lines.push(`**Kosten:** ${cost.quantity} ${cost.unit}`);
  }

  const damage = asRecord(record.damage);
  const damageType = asRecord(damage?.damage_type);
  if (damage?.damage_dice && damageType?.name) {
    lines.push(`**Schaden:** ${damage.damage_dice} ${damageType.name}`);
  }

  if (record.weight != null) {
    lines.push(`**Gewicht:** ${record.weight} lb.`);
  }

  const properties = Array.isArray(record.properties)
    ? record.properties
        .map((entry) => asRecord(entry)?.name)
        .filter((entry): entry is string => Boolean(entry))
    : [];
  if (properties.length > 0) {
    lines.push(`**Eigenschaften:** ${properties.join(", ")}`);
  }

  const desc = Array.isArray(record.desc)
    ? record.desc.map((entry) => asString(entry)).filter(Boolean).join("\n\n")
    : asString(record.desc);
  if (desc) {
    lines.push("", desc);
  }

  return lines.join("\n\n");
}
