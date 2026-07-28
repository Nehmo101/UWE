import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "@uwe/database/server";
import {
  createTestFamilyClient,
  createTestDatabaseUrl,
  type FamilyPrismaClient,
} from "@uwe/database/test-helpers";
import { createKitchenService, KitchenService } from "./recipe-service";

describe("KitchenService recipe CRUD", () => {
  let databaseUrl: string;
  let db: ReturnType<typeof createPrismaClient>;
  let familyDb: FamilyPrismaClient;
  let service: KitchenService;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    familyDb = createTestFamilyClient();
    service = createKitchenService(familyDb, db);
  });

  after(async () => {
    await db.$disconnect();
    await familyDb.$disconnect();
  });

  it("creates a recipe with ingredients and normalized names", async () => {
    const recipe = await service.createRecipe({
      title: "Tomatensauce",
      description: "Einfache Basis",
      servingsBase: 2,
      durationMinutes: 30,
      tasteRating: 5,
      steps: ["Zwiebeln anbraten", "Tomaten dazu", "köcheln"],
      ingredients: [
        { name: "Tomaten", amount: 800, unit: "gram", category: "produce", sortIndex: 0 },
        { name: "Zwiebeln", amount: 2, unit: "piece", category: "produce", sortIndex: 1 },
        { name: "Salz", unit: "pinch", optional: true, sortIndex: 2 },
      ],
      tags: ["schnell", "vegan"],
    });

    assert.equal(recipe.title, "Tomatensauce");
    assert.equal(recipe.status, "active");
    assert.equal(recipe.ingredients.length, 3);

    const tomato = recipe.ingredients.find((i) => i.name === "Tomaten");
    assert.ok(tomato);
    assert.equal(tomato.normalizedName, "tomat");
    assert.equal(tomato.amount, 800);
    assert.equal(tomato.unit, "gram");

    const withTags = await service.getRecipe(recipe.id);
    assert.ok(withTags);
    const tagKeys = withTags.tags.map((t) => t.key).sort();
    assert.deepEqual(tagKeys, ["schnell", "vegan"]);
  });

  it("lists recipes filtered by status and tag", async () => {
    const draft = await service.createRecipe({
      title: "Entwurf-Rezept",
      status: "draft",
      steps: [],
      tags: ["experiment"],
    });

    const active = await service.listRecipes({ status: "active" });
    assert.ok(active.every((r) => r.status === "active"));
    assert.ok(!active.some((r) => r.id === draft.id));

    const drafts = await service.listRecipes({ status: "draft" });
    assert.ok(drafts.some((r) => r.id === draft.id));

    const byTag = await service.listRecipes({ tag: "experiment" });
    assert.deepEqual(
      byTag.map((r) => r.id),
      [draft.id],
    );

    const emptyTag = await service.listRecipes({ tag: "does-not-exist" });
    assert.deepEqual(emptyTag, []);
  });

  it("updates a recipe and replaces its ingredients", async () => {
    const recipe = await service.createRecipe({
      title: "Nudeln",
      steps: ["kochen"],
      ingredients: [{ name: "Nudeln", amount: 500, unit: "gram" }],
      tags: ["schnell"],
    });

    const updated = await service.updateRecipe(recipe.id, {
      title: "Nudeln mit Pesto",
      tasteRating: 4,
      ingredients: [
        { name: "Nudeln", amount: 400, unit: "gram", sortIndex: 0 },
        { name: "Pesto", amount: 1, unit: "pack", sortIndex: 1 },
      ],
      tags: ["schnell", "kindgerecht"],
    });

    assert.ok(updated);
    assert.equal(updated.title, "Nudeln mit Pesto");
    assert.equal(updated.tasteRating, 4);
    assert.equal(updated.ingredients.length, 2);
    assert.deepEqual(
      updated.ingredients.map((i) => i.name),
      ["Nudeln", "Pesto"],
    );
    assert.equal(updated.ingredients[0]?.amount, 400);
    assert.deepEqual(
      updated.tags.map((t) => t.key).sort(),
      ["kindgerecht", "schnell"],
    );

    // Alte Zutaten sind wirklich ersetzt, nicht dupliziert.
    const ingredientCount = await familyDb.recipeIngredient.count({ where: { recipeId: recipe.id } });
    assert.equal(ingredientCount, 2);
  });

  it("archives a recipe", async () => {
    const recipe = await service.createRecipe({ title: "Altes Rezept", steps: [] });
    const archived = await service.archiveRecipe(recipe.id);
    assert.ok(archived);
    assert.equal(archived.status, "archived");

    const active = await service.listRecipes({ status: "active" });
    assert.ok(!active.some((r) => r.id === recipe.id));
  });

  it("reports status counts", async () => {
    const counts = await service.getStatusCounts();
    assert.ok(counts.active >= 1);
    assert.ok(counts.draft >= 1);
    assert.ok(counts.archived >= 1);
  });
});
