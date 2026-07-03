import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consolidateIngredients,
  groupByCategory,
  scaleAmount,
  type MergeableIngredient,
} from "./ingredient-merge";

function ing(overrides: Partial<MergeableIngredient>): MergeableIngredient {
  return { name: "Zutat", ...overrides };
}

describe("scaleAmount", () => {
  it("scales a numeric amount", () => {
    assert.equal(scaleAmount(400, 2.5 / 2), 500);
  });
  it("keeps amountless ingredients amountless", () => {
    assert.equal(scaleAmount(null, 3), null);
    assert.equal(scaleAmount(undefined, 3), null);
  });
});

describe("consolidateIngredients", () => {
  it("adds two same-unit amounts of the same ingredient (2× 400 g → 800 g)", () => {
    const result = consolidateIngredients([
      ing({ name: "Tomaten", normalizedName: "tomate", amount: 400, unit: "gram" }),
      ing({ name: "Tomate", normalizedName: "tomate", amount: 400, unit: "gram" }),
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].amount, 800);
    assert.equal(result[0].unit, "gram");
  });

  it("keeps incompatible units of the same ingredient separate", () => {
    const result = consolidateIngredients([
      ing({ name: "Tomaten", normalizedName: "tomate", amount: 200, unit: "gram" }),
      ing({ name: "Tomaten", normalizedName: "tomate", amount: 2, unit: "piece" }),
    ]);
    assert.equal(result.length, 2);
  });

  it("becomes amountless when one side has no amount", () => {
    const result = consolidateIngredients([
      ing({ name: "Salz", normalizedName: "salz", amount: 5, unit: "gram" }),
      ing({ name: "Salz", normalizedName: "salz", amount: null, unit: "gram" }),
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].amount, null);
  });

  it("keeps distinct freeform ingredients apart by unitLabel", () => {
    const result = consolidateIngredients([
      ing({ name: "Brühe", normalizedName: "bruhe", amount: 1, unit: "freeform", unitLabel: "Würfel" }),
      ing({ name: "Brühe", normalizedName: "bruhe", amount: 1, unit: "freeform", unitLabel: "Liter" }),
    ]);
    assert.equal(result.length, 2);
  });

  it("unions source recipe ids and prefers a concrete category", () => {
    const result = consolidateIngredients([
      ing({ name: "Zwiebel", normalizedName: "zwiebel", amount: 1, unit: "piece", category: "other", sourceRecipeIds: ["r1"] }),
      ing({ name: "Zwiebel", normalizedName: "zwiebel", amount: 2, unit: "piece", category: "produce", sourceRecipeIds: ["r2"] }),
    ]);
    assert.equal(result[0].amount, 3);
    assert.equal(result[0].category, "produce");
    assert.deepEqual([...result[0].sourceRecipeIds].sort(), ["r1", "r2"]);
  });

  it("ignores nameless entries and preserves first-seen order", () => {
    const result = consolidateIngredients([
      ing({ name: "  ", amount: 1 }),
      ing({ name: "Mehl", normalizedName: "mehl", amount: 500, unit: "gram" }),
      ing({ name: "Zucker", normalizedName: "zucker", amount: 100, unit: "gram" }),
    ]);
    assert.deepEqual(result.map((r) => r.name), ["Mehl", "Zucker"]);
  });
});

describe("groupByCategory", () => {
  it("buckets by category preserving first-seen order", () => {
    const grouped = groupByCategory(
      consolidateIngredients([
        ing({ name: "Apfel", normalizedName: "apfel", amount: 3, unit: "piece", category: "produce" }),
        ing({ name: "Milch", normalizedName: "milch", amount: 1000, unit: "milliliter", category: "chilled" }),
        ing({ name: "Banane", normalizedName: "banane", amount: 2, unit: "piece", category: "produce" }),
      ]),
    );
    assert.deepEqual(grouped.map((g) => g.category), ["produce", "chilled"]);
    assert.equal(grouped[0].items.length, 2);
  });
});
