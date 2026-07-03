/**
 * Heuristische Extraktion strukturierter Rezeptdaten aus OCR-Text (Scan-Inbox
 * Phase S3). Reiner, testbarer Parser ohne Seiteneffekte. Erkennt deutsche
 * Abschnittsmarker (Zutaten / Zubereitung) und zerlegt Zutaten und Schritte;
 * die Zeilen-in-Menge/Einheit-Zerlegung erledigt `parseIngredientLines` aus
 * `@uwe/kitchen`. Findet der Parser keine Marker, bleibt alles leer — der Scan
 * wird dann nur mit Freitext-Notizen abgelegt (kein Fehlversuch).
 */
import { parseIngredientLines, type RecipeIngredientInput } from "@uwe/kitchen";

export interface ParsedRecipe {
  ingredients: RecipeIngredientInput[];
  steps: string[];
}

const INGREDIENT_MARKERS = ["zutaten", "einkaufsliste", "du brauchst", "man braucht"];
const STEP_MARKERS = [
  "zubereitung",
  "zubereitungsschritte",
  "anleitung",
  "schritte",
  "so geht's",
  "so gehts",
  "kochanleitung",
];

interface MarkerHit {
  /** Index des Markerbeginns im Text. */
  start: number;
  /** Index direkt hinter dem Marker (Beginn des Inhalts). */
  end: number;
}

/** Erster passende Marker ab `from` (kleinster Startindex), oder null. */
function findMarker(lower: string, markers: string[], from = 0): MarkerHit | null {
  let best: MarkerHit | null = null;
  for (const marker of markers) {
    const at = lower.indexOf(marker, from);
    if (at !== -1 && (best === null || at < best.start)) {
      best = { start: at, end: at + marker.length };
    }
  }
  return best;
}

/**
 * Zerlegt einen Zutaten-Block in einzelne Zeilen. Trennt an Zeilenumbrüchen,
 * Semikolons und Listen-Kommas (Komma + Leerraum) — dabei bleibt das deutsche
 * Dezimalkomma („1,5 kg") unangetastet, weil ihm kein Leerraum folgt.
 */
function splitIngredientBlock(block: string): string {
  return block
    .replace(/^[:\s]+/, "")
    .split(/\n|;|,\s+/)
    .map((line) => line.trim().replace(/[.;,]+$/, "").trim())
    .filter(Boolean)
    .join("\n");
}

function splitSteps(block: string): string[] {
  return block
    .replace(/^[:\s]+/, "")
    .split(/\n|(?<=\.)\s+/)
    .map((step) => step.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

export function parseRecipeText(ocrText: string): ParsedRecipe {
  const text = ocrText.replace(/\r/g, "");
  const lower = text.toLowerCase();

  const ingredientMarker = findMarker(lower, INGREDIENT_MARKERS);
  const stepMarker = findMarker(lower, STEP_MARKERS, ingredientMarker?.end ?? 0);

  let ingredientsBlock = "";
  if (ingredientMarker) {
    ingredientsBlock = stepMarker
      ? text.slice(ingredientMarker.end, stepMarker.start)
      : text.slice(ingredientMarker.end);
  }

  const stepsBlock = stepMarker ? text.slice(stepMarker.end) : "";

  const ingredients = ingredientsBlock
    ? parseIngredientLines(splitIngredientBlock(ingredientsBlock))
    : [];
  const steps = stepsBlock ? splitSteps(stepsBlock) : [];

  return { ingredients, steps };
}
