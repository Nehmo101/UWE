/**
 * Pure Einheiten- und Namens-Helfer für die Küche.
 *
 * Bewusst framework-agnostisch, keine DB-/Prisma-Imports. Es findet KEINE
 * Umrechnung zwischen Einheiten-Arten statt (Gramm bleibt Masse, Stück bleibt
 * Anzahl). Innerhalb einer Art wird nur zur Anzeige skaliert (g ↔ kg, ml ↔ l).
 */
import {
  INGREDIENT_UNIT_SHORT_LABELS,
  type IngredientUnit,
  type RecipeIngredientInput,
} from "./kitchen-types";

/** Grobe Einheiten-Gruppe — Basis für Merge-Kompatibilität (nie gruppenübergreifend). */
export type UnitGroup = "mass" | "volume" | "count" | "other";

export function unitGroup(unit: IngredientUnit): UnitGroup {
  switch (unit) {
    case "gram":
      return "mass";
    case "milliliter":
      return "volume";
    case "piece":
      return "count";
    default:
      // tbsp, tsp, pinch, bunch, pack, freeform: eigene, nicht umrechenbare Größen.
      return "other";
  }
}

/**
 * Merge-Key für Zutaten: kleingeschrieben, getrimmt, Leerraum kollabiert und
 * eine einfache deutsche Plural→Singular-Heuristik. Bewusst simpel — Ziel ist
 * ein stabiler Schlüssel, unter dem „Tomaten" und „Tomate" zusammenfallen, nicht
 * linguistische Korrektheit.
 */
export function normalizeIngredientName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();

  if (!base) {
    return "";
  }

  // Nur das letzte Wort singularisieren (z. B. „rote zwiebeln" → „rote zwiebel").
  const parts = base.split(" ");
  const last = parts[parts.length - 1] ?? "";
  parts[parts.length - 1] = singularizeWord(last);
  return parts.join(" ");
}

const PLURAL_SUFFIXES = ["nen", "en", "er", "e", "n", "s"] as const;

function singularizeWord(word: string): string {
  for (const suffix of PLURAL_SUFFIXES) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      return word.slice(0, word.length - suffix.length);
    }
  }
  return word;
}

/** Deutsche Zahl: Komma als Dezimaltrenner, bis zu 2 Nachkommastellen, ohne Nullen. */
export function formatGermanNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const rounded = Math.round(value * 100) / 100;
  const fixed = rounded.toFixed(2);
  const trimmed = fixed.replace(/\.?0+$/, "");
  return trimmed.replace(".", ",");
}

/**
 * Menschenlesbare Menge, z. B. „800 g", „1,2 kg", „2 Stück", „1 EL",
 * „2 Bund Petersilie". `unitLabel` überschreibt bei `freeform` die Anzeige.
 */
export function formatAmount(
  amount: number | null | undefined,
  unit: IngredientUnit = "freeform",
  unitLabel?: string | null,
): string {
  const label = unitLabel?.trim() || "";

  if (amount == null || !Number.isFinite(amount)) {
    // Keine Menge: nur das freie Label bzw. die Einheit selbst zeigen.
    if (label) return label;
    return INGREDIENT_UNIT_SHORT_LABELS[unit] || "";
  }

  const group = unitGroup(unit);

  if (group === "mass") {
    return amount >= 1000
      ? `${formatGermanNumber(amount / 1000)} kg`
      : `${formatGermanNumber(amount)} g`;
  }

  if (group === "volume") {
    return amount >= 1000
      ? `${formatGermanNumber(amount / 1000)} l`
      : `${formatGermanNumber(amount)} ml`;
  }

  if (unit === "freeform") {
    return label
      ? `${formatGermanNumber(amount)} ${label}`
      : formatGermanNumber(amount);
  }

  // count (Stück) sowie EL/TL/Prise/Bund/Pck.: „<n> <Kurzlabel> [freies Label]".
  const short = INGREDIENT_UNIT_SHORT_LABELS[unit];
  const head = short ? `${formatGermanNumber(amount)} ${short}` : formatGermanNumber(amount);
  return label ? `${head} ${label}` : head;
}

/** Deutsche Zahl parsen (Komma oder Punkt als Dezimaltrenner). */
export function parseGermanNumber(token: string): number | null {
  const normalized = token.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Einheiten-Aliase für die Text-Eingabe. `factor` rechnet auf die Basis-Einheit
 * innerhalb derselben Gruppe (kg→g, l→ml), niemals gruppenübergreifend.
 */
const UNIT_ALIASES: Record<string, { unit: IngredientUnit; factor: number }> = {
  g: { unit: "gram", factor: 1 },
  gramm: { unit: "gram", factor: 1 },
  kg: { unit: "gram", factor: 1000 },
  ml: { unit: "milliliter", factor: 1 },
  l: { unit: "milliliter", factor: 1000 },
  liter: { unit: "milliliter", factor: 1000 },
  stück: { unit: "piece", factor: 1 },
  stk: { unit: "piece", factor: 1 },
  el: { unit: "tbsp", factor: 1 },
  tl: { unit: "tsp", factor: 1 },
  prise: { unit: "pinch", factor: 1 },
  prisen: { unit: "pinch", factor: 1 },
  bund: { unit: "bunch", factor: 1 },
  packung: { unit: "pack", factor: 1 },
  pck: { unit: "pack", factor: 1 },
  pack: { unit: "pack", factor: 1 },
};

/**
 * Parst eine Zutaten-Zeile im Format „[Menge] [Einheit] Name",
 * z. B. „800 g Tomaten", „2 Stück Zwiebeln", „1 kg Mehl", „Salz".
 * Gibt `null` für leere Zeilen zurück.
 */
export function parseIngredientLine(line: string): RecipeIngredientInput | null {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  let amount: number | null = null;
  let unit: IngredientUnit = "freeform";

  const maybeAmount = parseGermanNumber(tokens[0] ?? "");
  if (maybeAmount !== null) {
    amount = maybeAmount;
    tokens.shift();
    const alias = UNIT_ALIASES[(tokens[0] ?? "").toLowerCase()];
    if (alias) {
      unit = alias.unit;
      amount *= alias.factor;
      tokens.shift();
    }
  }

  const name = tokens.join(" ").trim();
  if (!name) {
    return null;
  }
  return { name, amount, unit };
}

/** Mehrere Zutaten-Zeilen parsen (leere Zeilen werden verworfen). */
export function parseIngredientLines(raw: string): RecipeIngredientInput[] {
  return raw
    .split("\n")
    .map(parseIngredientLine)
    .filter((item): item is RecipeIngredientInput => item !== null)
    .map((item, index) => ({ ...item, sortIndex: index }));
}

/** Parser-freundliche Einheiten-Token für die Rück-Serialisierung. */
const UNIT_TOKENS: Record<IngredientUnit, string> = {
  gram: "g",
  milliliter: "ml",
  piece: "Stück",
  tbsp: "EL",
  tsp: "TL",
  pinch: "Prise",
  bunch: "Bund",
  pack: "Packung",
  freeform: "",
};

/**
 * Serialisiert eine Zutat zurück in die Text-Zeilenform (Inverse zu
 * `parseIngredientLine`), damit der Editor Zutaten runden kann.
 */
export function serializeIngredientLine(input: RecipeIngredientInput): string {
  const parts: string[] = [];
  if (input.amount != null && Number.isFinite(input.amount)) {
    parts.push(formatGermanNumber(input.amount));
    const token = UNIT_TOKENS[input.unit ?? "freeform"];
    if (token) {
      parts.push(token);
    }
  }
  parts.push(input.name.trim());
  if (input.unitLabel?.trim()) {
    parts.push(input.unitLabel.trim());
  }
  return parts.join(" ").trim();
}

/** Zutatenliste als mehrzeiligen Editor-Text serialisieren. */
export function serializeIngredientLines(list: RecipeIngredientInput[]): string {
  return list.map(serializeIngredientLine).join("\n");
}
