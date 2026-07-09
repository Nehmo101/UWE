/**
 * Magic-Item-Werkbank: strukturierte Item-Daten + Export.
 *
 * Trennt bewusst sichtbare Beschreibung (Spieler) von DM-Geheimnis/Fluch.
 * Die Export-Funktionen sind pure und testbar; `includeSecrets` steuert, ob ein
 * DM-Export (mit Fluch/Geheimnis) oder ein Spieler-Handout erzeugt wird.
 */

export type ItemRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "very_rare"
  | "legendary"
  | "artifact";

export const ITEM_RARITIES: ItemRarity[] = [
  "common",
  "uncommon",
  "rare",
  "very_rare",
  "legendary",
  "artifact",
];

export const ITEM_RARITY_LABELS: Record<ItemRarity, string> = {
  common: "gewöhnlich",
  uncommon: "ungewöhnlich",
  rare: "selten",
  very_rare: "sehr selten",
  legendary: "legendär",
  artifact: "Artefakt",
};

const RARITY_5E: Record<ItemRarity, string> = {
  common: "common",
  uncommon: "uncommon",
  rare: "rare",
  very_rare: "very rare",
  legendary: "legendary",
  artifact: "artifact",
};

export interface MagicItemData {
  /** z. B. „Wundersamer Gegenstand", „Waffe (Langschwert)". */
  itemType?: string;
  rarity?: ItemRarity | string;
  requiresAttunement?: boolean;
  /** z. B. „durch einen Zauberwirker". */
  attunementNote?: string;
  /** Von Spielern sichtbare Beschreibung. */
  visibleDescription?: string;
  /** Sichtbare, mechanische Eigenschaften (Bullet-Points). */
  properties?: string[];
  /** Nur-DM: verborgene Wahrheit des Gegenstands. */
  dmSecret?: string;
  /** Nur-DM: Fluch / Nachteil. */
  curse?: string;
  /** Wiki-Seite des aktuellen Besitzers (Spieler-Charakter, NPC, Fraktion …). */
  ownerPageId?: string;
}

export function rarityLabel(rarity: string | undefined): string {
  if (!rarity) return "";
  return (ITEM_RARITY_LABELS as Record<string, string>)[rarity] ?? rarity;
}

function attunementLine(data: MagicItemData): string {
  if (!data.requiresAttunement) return "";
  return data.attunementNote
    ? `(erfordert Einstimmung ${data.attunementNote.trim()})`
    : "(erfordert Einstimmung)";
}

/** Kopfzeile im 5e-Stil: „Typ, Seltenheit (Einstimmung)". */
export function buildItemSubtitle(data: MagicItemData): string {
  const parts: string[] = [];
  if (data.itemType) parts.push(data.itemType.trim());
  const rarityPart = rarityLabel(data.rarity);
  const attune = attunementLine(data);
  const tail = [rarityPart, attune].filter(Boolean).join(" ");
  if (tail) parts.push(tail);
  return parts.join(", ");
}

/** Homebrewery-Markdown. Mit `includeSecrets` werden Fluch/Geheimnis ergänzt. */
export function toHomebrewery(
  title: string,
  data: MagicItemData,
  includeSecrets = false,
): string {
  const lines: string[] = [];
  lines.push(`#### ${title.trim()}`);
  const subtitle = buildItemSubtitle(data);
  if (subtitle) lines.push(`*${subtitle}*`, "");
  if (data.visibleDescription?.trim()) {
    lines.push(data.visibleDescription.trim(), "");
  }
  for (const property of data.properties ?? []) {
    if (property.trim()) lines.push(`- ${property.trim()}`);
  }
  if (includeSecrets) {
    if (data.curse?.trim()) {
      lines.push("", `***Fluch.*** ${data.curse.trim()}`);
    }
    if (data.dmSecret?.trim()) {
      lines.push("", `> **DM-Geheimnis:** ${data.dmSecret.trim()}`);
    }
  }
  return lines.join("\n").trim();
}

/** Spieler-Handout — nie mit Fluch/Geheimnis. */
export function toPlayerHandout(title: string, data: MagicItemData): string {
  return toHomebrewery(title, data, false);
}

/** 5etools-kompatibles Item-JSON (Teilmenge). Player-safe, es sei denn includeSecrets. */
export function toFiveToolsJson(
  title: string,
  data: MagicItemData,
  includeSecrets = false,
): Record<string, unknown> {
  const entries: string[] = [];
  if (data.visibleDescription?.trim()) entries.push(data.visibleDescription.trim());
  for (const property of data.properties ?? []) {
    if (property.trim()) entries.push(property.trim());
  }
  if (includeSecrets && data.curse?.trim()) {
    entries.push(`Fluch. ${data.curse.trim()}`);
  }

  const rarity5e =
    data.rarity && data.rarity in RARITY_5E
      ? RARITY_5E[data.rarity as ItemRarity]
      : (data.rarity ?? "unknown");

  const json: Record<string, unknown> = {
    name: title.trim(),
    source: "UWE",
    rarity: rarity5e,
    wondrous: true,
    entries,
  };
  if (data.requiresAttunement) {
    json.reqAttune = data.attunementNote?.trim() ? data.attunementNote.trim() : true;
  }
  return json;
}

/** Entfernt DM-Felder für einen sicheren Spieler-Export. */
export function toPlayerSafeData(data: MagicItemData): MagicItemData {
  const { dmSecret: _dmSecret, curse: _curse, ...rest } = data;
  return rest;
}

/** Parsen von Json aus der DB in ein typisiertes MagicItemData. */
export function parseMagicItemData(raw: unknown): MagicItemData {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as Record<string, unknown>;
  const properties = Array.isArray(record.properties)
    ? record.properties.filter((p): p is string => typeof p === "string")
    : undefined;
  return {
    itemType: typeof record.itemType === "string" ? record.itemType : undefined,
    rarity: typeof record.rarity === "string" ? record.rarity : undefined,
    requiresAttunement: record.requiresAttunement === true,
    attunementNote: typeof record.attunementNote === "string" ? record.attunementNote : undefined,
    visibleDescription:
      typeof record.visibleDescription === "string" ? record.visibleDescription : undefined,
    properties,
    dmSecret: typeof record.dmSecret === "string" ? record.dmSecret : undefined,
    curse: typeof record.curse === "string" ? record.curse : undefined,
    ownerPageId: typeof record.ownerPageId === "string" ? record.ownerPageId : undefined,
  };
}
