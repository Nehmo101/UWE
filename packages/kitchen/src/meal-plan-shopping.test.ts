import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "@uwe/database/server";
import {
  createTestFamilyClient,
  createTestDatabaseUrl,
  type FamilyPrismaClient,
} from "@uwe/database/test-helpers";
import {
  createMealPlanService,
  datesOfIsoWeek,
  isoWeekOf,
} from "./meal-plan-service";
import { createShoppingService } from "./shopping-service";
import { createKitchenService } from "./recipe-service";

describe("ISO week helpers (pure)", () => {
  it("computes ISO week 1 for 2026-01-01 (a Thursday)", () => {
    assert.deepEqual(isoWeekOf(new Date("2026-01-01T12:00:00Z")), { isoYear: 2026, isoWeek: 1 });
  });

  it("week 1 of 2026 starts on Monday 2025-12-29", () => {
    const days = datesOfIsoWeek(2026, 1);
    assert.equal(days.length, 7);
    assert.equal(days[0].toISOString().slice(0, 10), "2025-12-29");
    assert.equal(days[6].toISOString().slice(0, 10), "2026-01-04");
  });

  it("round-trips: the Thursday of a week maps back to that week", () => {
    for (const [y, w] of [[2026, 1], [2026, 27], [2025, 52]] as const) {
      const thursday = datesOfIsoWeek(y, w)[3];
      assert.deepEqual(isoWeekOf(thursday), { isoYear: y, isoWeek: w });
    }
  });
});

describe("meal plan + shopping (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;
  let familyDb: FamilyPrismaClient;
  let recipeId: string;

  before(async () => {
    const url = createTestDatabaseUrl();
    db = createPrismaClient(url);
    familyDb = createTestFamilyClient();
    const kitchen = createKitchenService(familyDb, db);
    const recipe = await kitchen.createRecipe({
      title: "Tomatensauce",
      servingsBase: 2,
      ingredients: [
        { name: "Tomaten", amount: 400, unit: "gram", category: "produce" },
        { name: "Zwiebel", amount: 1, unit: "piece", category: "produce" },
        { name: "Salz", unit: "freeform" },
      ],
    });
    recipeId = recipe.id;
  });

  after(async () => {
    await db.$disconnect();
    await familyDb.$disconnect();
  });

  it("creates a week, adds an entry, and reads it back with the recipe", async () => {
    const meals = createMealPlanService(familyDb);
    const week = await meals.getOrCreateWeek(2026, 27, 3);
    const days = datesOfIsoWeek(2026, 27);
    await meals.setEntry({ weekId: week.id, date: days[4], slot: "dinner", recipeId });

    const loaded = await meals.getWeek(2026, 27);
    assert.ok(loaded);
    assert.equal(loaded.entries.length, 1);
    assert.equal(loaded.entries[0].recipe?.title, "Tomatensauce");

    const toggled = await meals.toggleCooked(loaded.entries[0].id);
    assert.equal(toggled.cooked, true);
  });

  it("generates a consolidated, scaled shopping list from the week", async () => {
    const meals = createMealPlanService(familyDb);
    const shopping = createShoppingService(familyDb);
    const week = await meals.getOrCreateWeek(2026, 28, 3);
    const days = datesOfIsoWeek(2026, 28);
    // Same recipe twice → ingredients must consolidate.
    await meals.setEntry({ weekId: week.id, date: days[0], slot: "dinner", recipeId });
    await meals.setEntry({ weekId: week.id, date: days[1], slot: "dinner", recipeId });

    const list = await shopping.generateFromWeek(week.id, {
      recurringBasics: [{ name: "Hafermilch", category: "chilled" }],
    });

    const tomato = list.items.find((i) => i.name === "Tomaten");
    assert.ok(tomato);
    // 400 g base for 2 servings, scaled to 3 servings, twice: 400 * 3/2 * 2 = 1200
    assert.equal(tomato.amount, 1200);
    assert.equal(tomato.unit, "gram");

    const basic = list.items.find((i) => i.recurring);
    assert.ok(basic);
    assert.equal(basic.name, "Hafermilch");

    // Salt is amountless (freeform, no amount) and must survive as a line.
    assert.ok(list.items.some((i) => i.name === "Salz"));

    const item = list.items[0];
    const toggled = await shopping.toggleItem(item.id);
    assert.equal(toggled.checked, true);
  });

  it("splits perishables needed late in the week into the fresh trip", async () => {
    const meals = createMealPlanService(familyDb);
    const shopping = createShoppingService(familyDb);
    const kitchen = createKitchenService(familyDb, db);
    const lateRecipe = await kitchen.createRecipe({
      title: "Freitags-Salat",
      servingsBase: 2,
      ingredients: [
        { name: "Feldsalat", amount: 200, unit: "gram", category: "produce" },
        { name: "TK-Erbsen", amount: 300, unit: "gram", category: "frozen" },
      ],
    });

    const week = await meals.getOrCreateWeek(2026, 30, 3);
    const days = datesOfIsoWeek(2026, 30);
    // Tomatensauce am Montag, Salat am Freitag.
    await meals.setEntry({ weekId: week.id, date: days[0], slot: "dinner", recipeId });
    await meals.setEntry({ weekId: week.id, date: days[4], slot: "dinner", recipeId: lateRecipe.id });

    const list = await shopping.generateFromWeek(week.id, {
      recurringBasics: [{ name: "Hafermilch", category: "chilled" }],
    });

    // Montags-Gemüse → Großeinkauf; Freitags-Salat (verderblich) → Frische-Einkauf.
    assert.equal(list.items.find((i) => i.name === "Tomaten")?.trip, "main");
    assert.equal(list.items.find((i) => i.name === "Feldsalat")?.trip, "fresh");
    // Tiefkühl hält — bleibt trotz spätem Verwendungstag im Großeinkauf.
    assert.equal(list.items.find((i) => i.name === "TK-Erbsen")?.trip, "main");
    // Grundausstattung ohne Verwendungstag → Großeinkauf.
    assert.equal(list.items.find((i) => i.recurring)?.trip, "main");
  });

  it("persists and clears the AI week draft", async () => {
    const meals = createMealPlanService(familyDb);
    const week = await meals.getOrCreateWeek(2026, 29, 3);

    const stored = await meals.setAiDraft(week.id, {
      summary: "Leichte Woche",
      days: [{ day: "Montag", slot: "dinner", title: "Tomatensauce", recipeId }],
    });
    assert.deepEqual((stored.aiDraft as { summary: string }).summary, "Leichte Woche");

    const reloaded = await meals.getWeek(2026, 29);
    assert.equal((reloaded?.aiDraft as { days: unknown[] }).days.length, 1);

    const cleared = await meals.setAiDraft(week.id, null);
    assert.equal(cleared.aiDraft, null);
  });
});
