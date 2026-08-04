import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDirectConnectorRegistry } from "@uwe/connector/direct";
import {
  buildKitchenAiContext,
  parseWeekSuggestion,
  resolveDraftDate,
  suggestWeek,
  type KitchenAiPantryItem,
  type KitchenAiRecipe,
} from "./ai-suggest";
import { datesOfIsoWeek } from "./meal-plan-service";

const RECIPES: KitchenAiRecipe[] = [
  { id: "r1", title: "Tomatensauce", tags: ["schnell", "vegan"], tasteRating: 5, effortRating: 2 },
  { id: "r2", title: "Ofengemüse", durationMinutes: 40 },
];

const PANTRY: KitchenAiPantryItem[] = [
  { name: "Tomaten", location: "fridge" },
  { name: "Nudeln", location: "pantry", lowStock: true },
];

async function readDirectRequest(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<Record<string, unknown>> {
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    assert.equal(done, false, "Direct stream closed before receiving a request");
    if (!value) continue;
    const frame = JSON.parse(decoder.decode(value)) as Record<string, unknown>;
    if (frame.kind === "request") return frame;
  }
}

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

  it("includes ingredients, cooking history, and pantry expiry", () => {
    const ctx = buildKitchenAiContext(
      [
        {
          id: "r1",
          title: "Wrap-Pfanne",
          ingredients: ["wrap", "paprika", "mais"],
          lastCookedDaysAgo: 21,
        },
        { id: "r2", title: "Neuling", ingredients: ["nudel"], lastCookedDaysAgo: null },
      ],
      [
        { name: "Wraps", location: "fridge", expiresInDays: 2 },
        { name: "Joghurt", expiresInDays: -1 },
      ],
    );
    assert.match(ctx.text, /Zutaten: wrap, paprika, mais/);
    assert.match(ctx.text, /zuletzt gekocht vor 21 Tagen/);
    assert.match(ctx.text, /noch nie gekocht/);
    assert.match(ctx.text, /Wraps @fridge \(läuft in 2 Tagen ab\)/);
    assert.match(ctx.text, /Joghurt \(abgelaufen\)/);
  });

  it("caps ingredient detail deterministically for large collections", () => {
    const many: KitchenAiRecipe[] = Array.from({ length: 70 }, (_, i) => ({
      id: `r${i}`,
      title: `Gericht ${String(i).padStart(2, "0")}`,
      ingredients: [`zutat-${i}`],
      // Rezepte 0–59 nie gekocht, 60–69 gestern gekocht → letztere fliegen raus.
      lastCookedDaysAgo: i < 60 ? null : 1,
    }));
    const ctx = buildKitchenAiContext(many, []);
    assert.match(ctx.text, /Zutaten: zutat-0\b/);
    assert.match(ctx.text, /Zutaten: zutat-59\b/);
    assert.doesNotMatch(ctx.text, /Zutaten: zutat-65\b/);
    // Titelzeile bleibt trotzdem für alle erhalten.
    assert.match(ctx.text, /\[r65\] Gericht 65/);
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

  it("parses invented days with ingredient lines (v2)", () => {
    const json = JSON.stringify({
      summary: "Reste-Woche",
      days: [
        {
          day: "Mittwoch",
          slot: "dinner",
          title: "Wrap-Auflauf",
          invented: true,
          ingredients: ["4 Stück Wraps", "200 g Käse", "", 42],
        },
      ],
    });
    const result = parseWeekSuggestion(json);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.draft.days[0].invented, true);
    // Leere Zeilen und Nicht-Strings werden still verworfen.
    assert.deepEqual(result.draft.days[0].ingredients, ["4 Stück Wraps", "200 g Käse"]);
  });

  it("keeps v1 drafts without invented/ingredients valid (backwards compat)", () => {
    const json = JSON.stringify({
      summary: "Alt",
      days: [{ day: "Montag", slot: "dinner", title: "Pasta", recipeId: "r1" }],
    });
    const result = parseWeekSuggestion(json);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.draft.days[0].invented, undefined);
    assert.equal(result.draft.days[0].ingredients, undefined);
  });

  it("ignores a non-array ingredients field instead of failing", () => {
    const json = JSON.stringify({
      days: [{ slot: "dinner", title: "X", invented: "ja", ingredients: "Wraps" }],
    });
    const result = parseWeekSuggestion(json);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.draft.days[0].invented, undefined);
    assert.equal(result.draft.days[0].ingredients, undefined);
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

describe("resolveDraftDate (pure)", () => {
  // KW 27/2026: Montag 2026-06-29 … Sonntag 2026-07-05.
  const week = datesOfIsoWeek(2026, 27);

  it("maps German weekday names to the matching ISO-week date", () => {
    assert.equal(resolveDraftDate("Montag", week).toISOString().slice(0, 10), "2026-06-29");
    assert.equal(resolveDraftDate("freitag", week).toISOString().slice(0, 10), "2026-07-03");
    assert.equal(resolveDraftDate("Sonntag", week).toISOString().slice(0, 10), "2026-07-05");
  });

  it("accepts two-letter abbreviations", () => {
    assert.equal(resolveDraftDate("Di", week).toISOString().slice(0, 10), "2026-06-30");
  });

  it("falls back to Monday for unresolvable labels", () => {
    assert.equal(resolveDraftDate("", week).toISOString().slice(0, 10), "2026-06-29");
    assert.equal(resolveDraftDate("irgendwann", week).toISOString().slice(0, 10), "2026-06-29");
  });
});

describe("suggestWeek (Direct)", () => {
  it("completes without touching the queue database", async () => {
    const registry = getDirectConnectorRegistry();
    const connectorId = "kitchen-direct-test";
    const session = registry.openSession({ connectorId, capabilities: ["llm_local"] });
    const reader = session.stream.getReader();
    const db = new Proxy({}, {
      get() {
        throw new Error("Direct execution must not access the database");
      },
    }) as Parameters<typeof suggestWeek>[0];

    try {
      const suggestion = suggestWeek(db, {
        recipes: RECIPES,
        pantry: PANTRY,
        goals: { dinnersOnly: true },
      });
      const request = await readDirectRequest(reader);
      assert.equal(request.type, "llm_generate");
      assert.equal(typeof request.requestId, "string");
      const requestId = request.requestId as string;
      registry.handleEvent(connectorId, {
        version: 1,
        kind: "accepted",
        requestId,
      });
      registry.handleEvent(connectorId, {
        version: 1,
        kind: "result",
        requestId,
        result: { text: '{"summary":"Direkt","days":[{"day":"Montag","slot":"dinner","title":"Pasta"}]}' },
      });

      const completed = await suggestion;
      assert.equal(completed.status, "ok");
      if (completed.status !== "ok") return;
      assert.equal(completed.draft.summary, "Direkt");
      assert.equal(completed.draft.days.length, 1);
    } finally {
      session.close();
      reader.releaseLock();
    }
  });
});
