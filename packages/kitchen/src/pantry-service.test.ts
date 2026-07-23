import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestBrainClient, type BrainPrismaClient } from "@uwe/database/test-helpers";
import {
  createPantryService,
  rankRecipesByPantry,
  type PantryService,
  type RankableRecipe,
} from "./pantry-service";

describe("rankRecipesByPantry (pure)", () => {
  const recipes: RankableRecipe[] = [
    {
      id: "r1",
      title: "Tomatensauce",
      ingredients: [
        { normalizedName: "tomat" },
        { normalizedName: "zwiebel" },
        { normalizedName: "salz", optional: true },
      ],
    },
    {
      id: "r2",
      title: "Nudeln mit Pesto",
      ingredients: [{ normalizedName: "nudel" }, { normalizedName: "pesto" }],
    },
    {
      id: "r3",
      title: "Reis pur",
      ingredients: [{ normalizedName: "reis" }],
    },
  ];

  it("ranks recipes by number of matched required ingredients", () => {
    const ranked = rankRecipesByPantry(recipes, ["tomat", "zwiebel", "nudel"]);
    assert.equal(ranked[0].recipe.id, "r1");
    assert.equal(ranked[0].matchCount, 2);
    assert.equal(ranked[0].requiredCount, 2);
    assert.equal(ranked[1].recipe.id, "r2");
    assert.equal(ranked[1].matchCount, 1);
  });

  it("drops recipes without a single match and ignores optional ingredients", () => {
    // „salz" is optional → does not count as a match on its own.
    const ranked = rankRecipesByPantry(recipes, ["salz"]);
    assert.equal(ranked.length, 0);
  });

  it("breaks ties by coverage then title", () => {
    // Both match 1 ingredient; r3 covers 1/1 (100%), r2 covers 1/2 (50%).
    const ranked = rankRecipesByPantry(recipes, ["reis", "nudel"]);
    assert.equal(ranked[0].recipe.id, "r3");
    assert.equal(ranked[1].recipe.id, "r2");
  });

  it("ignores empty pantry names", () => {
    const ranked = rankRecipesByPantry(recipes, ["", "tomat"]);
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].recipe.id, "r1");
  });
});

describe("PantryService (integration)", () => {
  let db: BrainPrismaClient;
  let service: PantryService;

  before(() => {
    db = createTestBrainClient();
    service = createPantryService(db);
  });

  after(async () => {
    await db.$disconnect();
  });

  it("creates an item with a normalized name", async () => {
    const item = await service.create({
      name: "Tomaten",
      location: "fridge",
      amount: 400,
      unit: "gram",
    });
    assert.equal(item.name, "Tomaten");
    assert.equal(item.normalizedName, "tomat");
    assert.equal(item.location, "fridge");
    assert.equal(item.amount, 400);
  });

  it("lists items and filters by location", async () => {
    await service.create({ name: "Basilikum", location: "spices" });
    const spices = await service.list({ location: "spices" });
    assert.ok(spices.every((i) => i.location === "spices"));
    assert.ok(spices.some((i) => i.name === "Basilikum"));

    const all = await service.list();
    assert.ok(all.length >= spices.length);
  });

  it("updates an item and re-normalizes on rename", async () => {
    const created = await service.create({ name: "Zwiebeln", location: "pantry" });
    const updated = await service.update(created.id, { name: "Kartoffeln", lowStock: true });
    assert.equal(updated.name, "Kartoffeln");
    assert.equal(updated.normalizedName, "kartoffel");
    assert.equal(updated.lowStock, true);
  });

  it("removes an item", async () => {
    const created = await service.create({ name: "Wegwerf" });
    await service.remove(created.id);
    const found = await db.pantryItem.findUnique({ where: { id: created.id } });
    assert.equal(found, null);
  });

  it("reports expiring and expired items within the window", async () => {
    const now = new Date("2026-07-03T12:00:00Z");
    const soon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const past = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const far = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await service.create({ name: "Ablauf-Bald", expiresAt: soon });
    await service.create({ name: "Ablauf-Vorbei", expiresAt: past });
    await service.create({ name: "Ablauf-Fern", expiresAt: far });
    await service.create({ name: "Ohne-Ablauf" });

    const expiring = await service.getExpiring(5, now);
    const names = expiring.map((i) => i.name);
    assert.ok(names.includes("Ablauf-Bald"));
    assert.ok(names.includes("Ablauf-Vorbei"));
    assert.ok(!names.includes("Ablauf-Fern"));
    assert.ok(!names.includes("Ohne-Ablauf"));
  });
});
