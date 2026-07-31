/**
 * Rezeptkarten für den 6×4-Zoll-Drucker.
 *
 * Baut aus einem Rezept fertige `LabelExportOptions` — je Eintrag eine Karte.
 * Gerendert wird mit den vorhandenen, reinen Renderern aus
 * `@uwe/database` (`renderMultiLabelHtml`, `renderMultiLabelPdfAsync`); die
 * Etiketten-Tabellen aus `uwe.db` bleiben unberührt, hier entsteht nichts
 * Gespeichertes.
 *
 * Zwei Modi, weil beide Fälle vorkommen:
 *
 *  - `compact` — eine Karte. Zutaten links, Schritte rechts. Was nicht passt,
 *    wird gekürzt; für das schnelle Rezept am Kühlschrank.
 *  - `set` — Karte 1 Zutaten und Übersicht, Folgekarten die Schritte. Nichts
 *    geht verloren; für das lange Rezept, das man beim Kochen durchblättert.
 *
 * Rein und ohne Datenbank, damit testbar.
 */
import {
  LABEL_CANVAS_HEIGHT,
  LABEL_CANVAS_WIDTH,
  LABEL_SAFE_MARGIN,
  type LabelElement,
} from "@uwe/database/label-elements";
import type { LabelExportOptions } from "@uwe/database/server";

export type RecipeCardMode = "compact" | "set";

export interface RecipeCardIngredient {
  name: string;
  amount?: number | null;
  unitLabel?: string | null;
  optional?: boolean;
}

export interface RecipeCardInput {
  title: string;
  description?: string | null;
  servingsBase?: number | null;
  durationMinutes?: number | null;
  ingredients: readonly RecipeCardIngredient[];
  steps: readonly string[];
}

const M = LABEL_SAFE_MARGIN;
const USABLE_WIDTH = LABEL_CANVAS_WIDTH - M * 2;
const USABLE_HEIGHT = LABEL_CANVAS_HEIGHT - M * 2;

/**
 * Zeichenbudget einer Textfläche, grob geschätzt aus Fläche und Schriftgröße.
 * Lieber etwas zu vorsichtig: eine überlaufende Karte ist unbrauchbar, eine
 * halbleere nur schade.
 */
function charBudget(widthInches: number, heightInches: number, fontSize: number): number {
  const charsPerLine = Math.max(1, Math.floor((widthInches * 96) / (fontSize * 0.52)));
  const lines = Math.max(1, Math.floor((heightInches * 96) / (fontSize * 1.35)));
  return charsPerLine * lines;
}

function truncate(text: string, budget: number): string {
  if (text.length <= budget) return text;
  const cut = text.slice(0, Math.max(0, budget - 1));
  const lastBreak = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
  return `${(lastBreak > budget * 0.6 ? cut.slice(0, lastBreak) : cut).trimEnd()}…`;
}

export function formatIngredient(ingredient: RecipeCardIngredient): string {
  const amount =
    ingredient.amount !== null && ingredient.amount !== undefined
      ? String(Number(ingredient.amount.toFixed(2)))
      : "";
  const unit = ingredient.unitLabel?.trim() ?? "";
  const quantity = [amount, unit].filter((part) => part !== "").join(" ");
  const suffix = ingredient.optional ? " (optional)" : "";

  return quantity === ""
    ? `• ${ingredient.name}${suffix}`
    : `• ${quantity} ${ingredient.name}${suffix}`;
}

function metaLine(recipe: RecipeCardInput): string {
  const parts: string[] = [];
  if (recipe.servingsBase) parts.push(`${recipe.servingsBase} Portionen`);
  if (recipe.durationMinutes) parts.push(`${recipe.durationMinutes} Min.`);
  return parts.join(" · ");
}

let cardCounter = 0;

function element(
  type: LabelElement["type"],
  text: string,
  box: { x: number; y: number; width: number; height: number },
  style: LabelElement["style"],
): LabelElement {
  cardCounter += 1;
  return {
    id: `recipe_${type}_${cardCounter}`,
    type,
    ...box,
    zIndex: cardCounter,
    visible: true,
    text,
    style,
  };
}

function card(title: string, elements: LabelElement[]): LabelExportOptions {
  return {
    title,
    content: { title, text: "" },
    layoutSettings: {
      mode: "text_only",
      truncateToPage: true,
      truncateLongWords: true,
      widthInches: LABEL_CANVAS_WIDTH,
      heightInches: LABEL_CANVAS_HEIGHT,
      showSafeArea: false,
      showCropMarks: false,
      printFriendly: true,
      elements,
    },
  };
}

/** Verteilt Schritte auf Karten, ohne einen Schritt zu zerreißen. */
function chunkSteps(steps: readonly string[], budget: number): string[][] {
  const pages: string[][] = [];
  let current: string[] = [];
  let used = 0;

  steps.forEach((step, index) => {
    const line = `${index + 1}. ${step}`;
    // Ein einzelner überlanger Schritt bekommt seine eigene Karte, statt die
    // Aufteilung zum Stillstand zu bringen.
    if (current.length > 0 && used + line.length > budget) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(line);
    used += line.length + 2;
  });

  if (current.length > 0) pages.push(current);
  return pages.length > 0 ? pages : [[]];
}

function headerElements(recipe: RecipeCardInput, suffix = ""): LabelElement[] {
  const meta = metaLine(recipe);
  const elements = [
    element("title", `${recipe.title}${suffix}`, { x: M, y: M, width: USABLE_WIDTH, height: 0.45 }, {
      fontSize: 22,
      fontWeight: "bold",
    }),
  ];

  if (meta !== "") {
    elements.push(
      element("text", meta, { x: M, y: M + 0.45, width: USABLE_WIDTH, height: 0.22 }, {
        fontSize: 11,
        color: "#555555",
      }),
    );
  }

  return elements;
}

function compactCard(recipe: RecipeCardInput): LabelExportOptions[] {
  const top = M + (metaLine(recipe) === "" ? 0.5 : 0.72);
  const bodyHeight = USABLE_HEIGHT - (top - M);
  const leftWidth = USABLE_WIDTH * 0.42;
  const rightWidth = USABLE_WIDTH - leftWidth - 0.15;

  const ingredientText = recipe.ingredients.map(formatIngredient).join("\n");
  const stepText = recipe.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");

  const elements = [
    ...headerElements(recipe),
    element("text", "Zutaten", { x: M, y: top, width: leftWidth, height: 0.2 }, {
      fontSize: 11,
      fontWeight: "bold",
    }),
    element(
      "text",
      truncate(ingredientText, charBudget(leftWidth, bodyHeight - 0.25, 9)),
      { x: M, y: top + 0.22, width: leftWidth, height: bodyHeight - 0.25 },
      { fontSize: 9, lineHeight: 1.3 },
    ),
    element(
      "text",
      "Zubereitung",
      { x: M + leftWidth + 0.15, y: top, width: rightWidth, height: 0.2 },
      { fontSize: 11, fontWeight: "bold" },
    ),
    element(
      "text",
      truncate(stepText, charBudget(rightWidth, bodyHeight - 0.25, 9)),
      { x: M + leftWidth + 0.15, y: top + 0.22, width: rightWidth, height: bodyHeight - 0.25 },
      { fontSize: 9, lineHeight: 1.3 },
    ),
  ];

  return [card(recipe.title, elements)];
}

function cardSet(recipe: RecipeCardInput): LabelExportOptions[] {
  const top = M + (metaLine(recipe) === "" ? 0.5 : 0.72);
  const bodyHeight = USABLE_HEIGHT - (top - M);

  const stepPages = chunkSteps(recipe.steps, charBudget(USABLE_WIDTH, bodyHeight - 0.25, 11));
  const total = stepPages.length + 1;

  const first = card(recipe.title, [
    ...headerElements(recipe, ` (1/${total})`),
    element("text", "Zutaten", { x: M, y: top, width: USABLE_WIDTH, height: 0.2 }, {
      fontSize: 12,
      fontWeight: "bold",
    }),
    element(
      "text",
      truncate(
        recipe.ingredients.map(formatIngredient).join("\n"),
        charBudget(USABLE_WIDTH, bodyHeight - 0.25, 10),
      ),
      { x: M, y: top + 0.22, width: USABLE_WIDTH, height: bodyHeight - 0.25 },
      { fontSize: 10, lineHeight: 1.35 },
    ),
  ]);

  const stepCards = stepPages.map((page, index) =>
    card(`${recipe.title} — Schritte ${index + 1}`, [
      element(
        "title",
        `${recipe.title} (${index + 2}/${total})`,
        { x: M, y: M, width: USABLE_WIDTH, height: 0.4 },
        { fontSize: 16, fontWeight: "bold" },
      ),
      element(
        "text",
        page.join("\n\n"),
        { x: M, y: M + 0.45, width: USABLE_WIDTH, height: USABLE_HEIGHT - 0.45 },
        { fontSize: 11, lineHeight: 1.4 },
      ),
    ]),
  );

  return [first, ...stepCards];
}

/**
 * Baut die Karten eines Rezepts. `compact` liefert genau eine, `set` so viele
 * wie nötig — mindestens zwei, damit die Aufteilung erkennbar ist.
 */
export function buildRecipeCards(
  recipe: RecipeCardInput,
  mode: RecipeCardMode,
): LabelExportOptions[] {
  return mode === "compact" ? compactCard(recipe) : cardSet(recipe);
}
