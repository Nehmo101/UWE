import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildKitchenAiContext,
  parseWeekSuggestion,
  type KitchenAiPantryItem,
  type KitchenAiRecipe,
} from "./ai-suggest";

const RECIPES: KitchenAiRecipe[] = [
  { id: "r1", title: "Tomatensauce", tags: ["schnell", "vegan"], tasteRating: 5, effortRating: 2 },
  { id: "r2", title: "Ofengemüse", durationMinutes: 40 },
];

const PANTRY: KitchenAiPantryItem[] = [
  { name: "Tomaten", location: "fridge" },
  { name: "Nudeln", location: "pantry", lowStock: true },
];

describe("buildKitchenAiContext (pure)", () => {
  it("includes recipes, pantry, and goals with counts", () => {
    const ctx = buildKitchenAiContext(RECIPES, PANTRY, { lowEffort: true, mealPrepCount: 2 });
    assert.equal(ctx.recipeCount, 2);
    assert.equal(ctx.pantryCount, 2);
    assert.match(ctx.text, /\[r1\] Tomatensauce/);
    assert.match(ctx.text, /Tags: schnell, vegan/);
    assert.match(ctx.text, /Geschmack 5\/5/);
    assert.match(ctx.text, /Nudeln @pantry \(knapp\)/);
    assert.match(ctx.text, /Möglichst wenig Aufwand/);
    assert.match(ctx.text, /2 Meal-Prep-Gerichte/);
  });

  it("renders empty placeholders when nothing is present", () => {
    const ctx = buildKitchenAiContext([], [], {});
    assert.equal(ctx.recipeCount, 0);
    assert.equal(ctx.pantryCount, 0);
    assert.match(ctx.text, /\(keine Rezepte\)/);
    assert.match(ctx.text, /\(leer\)/);
    assert.match(ctx.text, /\(keine besonderen Ziele\)/);
  });
});

describe("parseWeekSuggestion (pure)", () => {
  it("parses a valid suggestion object", () => {
    const json = JSON.stringify({
      summary: "Leichte Woche",
      days: [
        { day: "Montag", slot: "dinner", title: "Tomatensauce", recipeId: "r1" },
        { day: "Dienstag", slot: "lunch", title: "Ofengemüse", note: "Reste einplanen" },
      ],
    });
    const result = parseWeekSuggestion(json);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.draft.summary, "Leichte Woche");
    assert.equal(result.draft.days.length, 2);
    assert.equal(result.draft.days[0].recipeId, "r1");
    assert.equal(result.draft.days[1].note, "Reste einplanen");
  });

  it("extracts JSON wrapped in prose / code fences", () => {
    const wrapped = "Hier dein Plan:\n```json\n{\"days\":[{\"slot\":\"dinner\",\"title\":\"Pasta\"}]}\n```\nGuten Appetit!";
    const result = parseWeekSuggestion(wrapped);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.draft.days[0].title, "Pasta");
  });

  it("returns a clean error for broken JSON (never partial)", () => {
    const result = parseWeekSuggestion('{"days": [ {"slot":"dinner", ');
    assert.equal(result.status, "parse_error");
  });

  it("rejects an invalid meal slot", () => {
    const json = JSON.stringify({ days: [{ slot: "brunch", title: "X" }] });
    const result = parseWeekSuggestion(json);
    assert.equal(result.status, "parse_error");
  });

  it("rejects a day entry without a title", () => {
    const json = JSON.stringify({ days: [{ slot: "dinner" }] });
    const result = parseWeekSuggestion(json);
    assert.equal(result.status, "parse_error");
  });

  it("rejects a response without days", () => {
    assert.equal(parseWeekSuggestion("{}").status, "parse_error");
    assert.equal(parseWeekSuggestion("").status, "parse_error");
    assert.equal(parseWeekSuggestion("no json here").status, "parse_error");
  });
});
