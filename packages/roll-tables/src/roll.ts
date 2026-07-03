export interface RollTableEntry {
  label: string;
  /** Relative Gewichtung, Standard 1. */
  weight?: number;
}

export const ROLL_TABLE_CATEGORIES = ["loot", "encounter", "names", "custom"] as const;
export type RollTableCategory = (typeof ROLL_TABLE_CATEGORIES)[number];

export const ROLL_TABLE_CATEGORY_LABELS: Record<RollTableCategory, string> = {
  loot: "Loot",
  encounter: "Zufalls-Encounter",
  names: "Namen",
  custom: "Eigene",
};

export function normalizeRollTableCategory(raw: string | null | undefined): RollTableCategory {
  const value = raw?.trim().toLowerCase();
  return (ROLL_TABLE_CATEGORIES as readonly string[]).includes(value ?? "")
    ? (value as RollTableCategory)
    : "custom";
}

/** Parses "Label | Gewicht"-Zeilen (eine pro Zeile, Gewicht optional). */
export function parseRollTableEntries(raw: string): RollTableEntry[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [labelPart, weightPart] = line.split("|").map((part) => part.trim());
      const weight = weightPart ? Number(weightPart) : undefined;
      return {
        label: labelPart ?? line,
        weight: Number.isFinite(weight) && weight! > 0 ? weight : undefined,
      };
    })
    .filter((entry) => entry.label.length > 0);
}

export function serializeRollTableEntries(entries: RollTableEntry[]): string {
  return entries
    .map((entry) => (entry.weight && entry.weight !== 1 ? `${entry.label} | ${entry.weight}` : entry.label))
    .join("\n");
}

/** Validates and narrows a JSON value into roll-table entries. */
export function coerceRollTableEntries(value: unknown): RollTableEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object",
    )
    .map((entry) => ({
      label: String(entry.label ?? "").trim(),
      weight:
        typeof entry.weight === "number" && Number.isFinite(entry.weight) && entry.weight > 0
          ? entry.weight
          : undefined,
    }))
    .filter((entry) => entry.label.length > 0);
}

export interface RollResult {
  entry: RollTableEntry;
  index: number;
  totalWeight: number;
}

/** Weighted random pick; RNG injectable for reproducible tests. */
export function rollOnTable(
  entries: RollTableEntry[],
  random: () => number = Math.random,
): RollResult | null {
  if (entries.length === 0) return null;

  const totalWeight = entries.reduce((sum, entry) => sum + (entry.weight ?? 1), 0);
  let ticket = random() * totalWeight;

  for (let index = 0; index < entries.length; index += 1) {
    ticket -= entries[index]!.weight ?? 1;
    if (ticket < 0) {
      return { entry: entries[index]!, index, totalWeight };
    }
  }

  const last = entries.length - 1;
  return { entry: entries[last]!, index: last, totalWeight };
}

/** Rolls simple dice notation like "d20", "2d6", "3d8+2". */
export function rollDice(
  notation: string,
  random: () => number = Math.random,
): { total: number; rolls: number[]; modifier: number } | null {
  const match = notation
    .trim()
    .toLowerCase()
    .match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) return null;

  const count = Math.min(100, Math.max(1, Number(match[1] || 1)));
  const sides = Math.min(1000, Math.max(2, Number(match[2])));
  const modifier = Number(match[3] ?? 0);

  const rolls: number[] = [];
  for (let i = 0; i < count; i += 1) {
    rolls.push(1 + Math.floor(random() * sides));
  }
  const total = rolls.reduce((sum, value) => sum + value, 0) + modifier;
  return { total, rolls, modifier };
}
