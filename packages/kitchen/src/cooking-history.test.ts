import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "@uwe/database/server";
import {
  createTestFamilyClient,
  createTestDatabaseUrl,
  type FamilyPrismaClient,
} from "@uwe/database/test-helpers";
import { daysSince, getRecipeHistory } from "./cooking-history";
import { createMealPlanService, datesOfIsoWeek, isoWeekOf } from "./meal-plan-service";
import { createKitchenService } from "./recipe-service";

describe("daysSince (pure)", () => {
  const now = new Date("2026-08-04T12:00:00Z");

  it("counts full days between date and now", () => {
    assert.equal(daysSince(new Date("2026-08-01T12:00:00Z"), now), 3);
    assert.equal(daysSince(new Date("2026-08-04T00:00:00Z"), now), 0);
  });

  it("clamps future dates to 0 and passes null through", () => {
    assert.equal(daysSince(new Date("2026-08-10T00:00:00Z"), now), 0);
    assert.equal(daysSince(null, now), null);
  });
});

describe("getRecipeHistory (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;
  let familyDb: FamilyPrismaClient;
  let recipeId: string;
  // "now" = Montag der Folgewoche, damit die Plan-Einträge in der Vergangenheit liegen.
  const week = datesOfIsoWeek(2026, 30);
  const now = new Date(datesOfIsoWeek(2026, 31)[0]);

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    familyDb = createTestFamilyClient();
    const kitchen = createKitchenService(familyDb, db);
    const recipe = await kitchen.createRecipe({ title: "Wraps" });
    recipeId = recipe.id;

    const meals = createMealPlanService(familyDb);
    const { isoYear, isoWeek } = isoWeekOf(week[0]);
    const planWeek = await meals.getOrCreateWeek(isoYear, isoWeek);
    // Montag geplant + gekocht, Freitag nur geplant.
    const cookedEntry = await meals.setEntry({
      weekId: planWeek.id,
      date: week[0],
      slot: "dinner",
      recipeId,
    });
    await meals.toggleCooked(cookedEntry.id);
    await meals.setEntry({ weekId: planWeek.id, date: week[4], slot: "dinner", recipeId });
    // Notiz-Eintrag ohne Rezept darf die Historie nicht beeinflussen.
    await meals.setEntry({
      weekId: planWeek.id,
      date: week[2],
      slot: "dinner",
      entryType: "note",
      note: "Auswärts",
    });
  });

  after(async () => {
    await db.$disconnect();
    await familyDb.$disconnect();
  });

  it("aggregates last cooked, last planned, and count per recipe", async () => {
    const history = await getRecipeHistory(familyDb, { now });
    const entry = history.get(recipeId);
    assert.ok(entry);
    assert.equal(entry.timesPlanned, 2);
    assert.equal(entry.lastCookedAt?.toISOString().slice(0, 10), week[0].toISOString().slice(0, 10));
    assert.equal(entry.lastPlannedAt?.toISOString().slice(0, 10), week[4].toISOString().slice(0, 10));
  });

  it("ignores entries outside the lookback window", async () => {
    const history = await getRecipeHistory(familyDb, { now, lookbackWeeks: 0 });
    assert.equal(history.get(recipeId), undefined);
  });
});
