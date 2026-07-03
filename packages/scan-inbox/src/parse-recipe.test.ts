import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRecipeText } from "./parse-recipe";

describe("parseRecipeText (pure, S3)", () => {
  it("parses an inline comma list with a trailing sentence", () => {
    const parsed = parseRecipeText("Zutaten: Mehl, Wasser. Zubereitung: backen.");
    assert.deepEqual(
      parsed.ingredients.map((i) => i.name),
      ["Mehl", "Wasser"],
    );
    assert.deepEqual(parsed.steps, ["backen."]);
  });

  it("parses a multi-line list with amounts, units and numbered steps", () => {
    const text = [
      "Pfannkuchen",
      "Zutaten",
      "400 g Mehl",
      "2 Eier",
      "1 Prise Salz",
      "",
      "Zubereitung",
      "1. Mehl und Eier verrühren.",
      "2. In der Pfanne backen.",
    ].join("\n");
    const parsed = parseRecipeText(text);

    const mehl = parsed.ingredients.find((i) => i.name === "Mehl");
    assert.ok(mehl);
    assert.equal(mehl.amount, 400);
    assert.equal(mehl.unit, "gram");

    const eier = parsed.ingredients.find((i) => i.name === "Eier");
    assert.equal(eier?.amount, 2);

    assert.deepEqual(parsed.steps, [
      "Mehl und Eier verrühren.",
      "In der Pfanne backen.",
    ]);
  });

  it("keeps the German decimal comma intact (does not split 1,5)", () => {
    const parsed = parseRecipeText("Zutaten: 1,5 kg Kartoffeln, 2 Zwiebeln Zubereitung: kochen");
    const kartoffeln = parsed.ingredients.find((i) => i.name === "Kartoffeln");
    assert.ok(kartoffeln);
    assert.equal(kartoffeln.unit, "gram");
    assert.equal(kartoffeln.amount, 1500); // 1,5 kg → 1500 g
    assert.ok(parsed.ingredients.some((i) => i.name === "Zwiebeln"));
  });

  it("returns empty structures when no recipe markers are present", () => {
    const parsed = parseRecipeText("Nur ein Fließtext ganz ohne Struktur oder Marker.");
    assert.deepEqual(parsed.ingredients, []);
    assert.deepEqual(parsed.steps, []);
  });
});
