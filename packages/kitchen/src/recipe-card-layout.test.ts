import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRecipeCards,
  formatIngredient,
  type RecipeCardInput,
} from "./recipe-card-layout";

function recipe(overrides: Partial<RecipeCardInput> = {}): RecipeCardInput {
  return {
    title: "Tomatensauce",
    servingsBase: 2,
    durationMinutes: 30,
    ingredients: [
      { name: "Tomaten", amount: 800, unitLabel: "g" },
      { name: "Zwiebeln", amount: 2, unitLabel: "Stk" },
      { name: "Salz", optional: true },
    ],
    steps: ["Zwiebeln anbraten", "Tomaten dazu", "20 Minuten köcheln"],
    ...overrides,
  };
}

/** Sammelt allen Text einer Karte, um Inhalte zu prüfen. */
function textOf(card: { layoutSettings: { elements?: { text?: string }[] } }): string {
  return (card.layoutSettings.elements ?? []).map((el) => el.text ?? "").join("\n");
}

describe("formatIngredient", () => {
  it("setzt Menge, Einheit und Namen zusammen", () => {
    assert.equal(formatIngredient({ name: "Tomaten", amount: 800, unitLabel: "g" }), "• 800 g Tomaten");
  });

  it("lässt die Menge weg, wenn keine da ist", () => {
    assert.equal(formatIngredient({ name: "Salz" }), "• Salz");
  });

  it("kennzeichnet optionale Zutaten", () => {
    assert.equal(formatIngredient({ name: "Salz", optional: true }), "• Salz (optional)");
  });

  it("kürzt überflüssige Nachkommastellen", () => {
    assert.equal(formatIngredient({ name: "Öl", amount: 1.5, unitLabel: "EL" }), "• 1.5 EL Öl");
    assert.equal(formatIngredient({ name: "Öl", amount: 2.0, unitLabel: "EL" }), "• 2 EL Öl");
  });
});

describe("buildRecipeCards — compact", () => {
  it("liefert genau eine Karte", () => {
    assert.equal(buildRecipeCards(recipe(), "compact").length, 1);
  });

  it("hat 6×4 Zoll als Kartenmaß", () => {
    const [card] = buildRecipeCards(recipe(), "compact");
    assert.equal(card?.layoutSettings.widthInches, 6);
    assert.equal(card?.layoutSettings.heightInches, 4);
  });

  it("enthält Titel, Zutaten und Schritte", () => {
    const [card] = buildRecipeCards(recipe(), "compact");
    const text = textOf(card!);

    assert.match(text, /Tomatensauce/);
    assert.match(text, /800 g Tomaten/);
    assert.match(text, /1\. Zwiebeln anbraten/);
  });

  it("zeigt Portionen und Dauer", () => {
    const [card] = buildRecipeCards(recipe(), "compact");
    assert.match(textOf(card!), /2 Portionen · 30 Min\./);
  });

  it("lässt die Kopfzeile weg, wenn weder Portionen noch Dauer bekannt sind", () => {
    const [card] = buildRecipeCards(
      recipe({ servingsBase: null, durationMinutes: null }),
      "compact",
    );
    assert.doesNotMatch(textOf(card!), /Portionen|Min\./);
  });

  it("kürzt ein überlanges Rezept, statt die Karte zu sprengen", () => {
    const long = recipe({
      steps: Array.from({ length: 60 }, (_, i) => `Schritt ${i + 1} mit sehr viel Erklärung dazu`),
    });
    const [card] = buildRecipeCards(long, "compact");

    assert.equal(buildRecipeCards(long, "compact").length, 1);
    assert.match(textOf(card!), /…/);
  });

  it("bleibt mit allen Elementen innerhalb der Kartenfläche", () => {
    const [card] = buildRecipeCards(recipe(), "compact");
    for (const el of card?.layoutSettings.elements ?? []) {
      assert.ok(el.x >= 0 && el.x + el.width <= 6.001, `x überläuft: ${el.id}`);
      assert.ok(el.y >= 0 && el.y + el.height <= 4.001, `y überläuft: ${el.id}`);
    }
  });
});

describe("buildRecipeCards — set", () => {
  it("liefert Zutatenkarte plus mindestens eine Schrittkarte", () => {
    const cards = buildRecipeCards(recipe(), "set");
    assert.ok(cards.length >= 2);
  });

  it("hat die Zutaten auf der ersten Karte und keine Schritte", () => {
    const [first] = buildRecipeCards(recipe(), "set");
    const text = textOf(first!);

    assert.match(text, /Zutaten/);
    assert.match(text, /800 g Tomaten/);
    assert.doesNotMatch(text, /Zwiebeln anbraten/);
  });

  it("nummeriert die Karten im Titel", () => {
    const cards = buildRecipeCards(recipe(), "set");
    assert.match(textOf(cards[0]!), new RegExp(`\\(1/${cards.length}\\)`));
    assert.match(textOf(cards[1]!), new RegExp(`\\(2/${cards.length}\\)`));
  });

  it("verteilt viele Schritte auf mehrere Karten", () => {
    const long = recipe({
      steps: Array.from({ length: 40 }, (_, i) => `Schritt ${i + 1} mit ausführlicher Erklärung`),
    });
    const cards = buildRecipeCards(long, "set");
    assert.ok(cards.length > 2, `erwartet mehrere Schrittkarten, waren ${cards.length}`);
  });

  it("verliert keinen Schritt", () => {
    const long = recipe({
      steps: Array.from({ length: 40 }, (_, i) => `Schritt ${i + 1} mit ausführlicher Erklärung`),
    });
    const all = buildRecipeCards(long, "set").map(textOf).join("\n");

    for (let i = 1; i <= 40; i += 1) {
      assert.match(all, new RegExp(`${i}\\. Schritt ${i} `), `Schritt ${i} fehlt`);
    }
  });

  it("zerreißt einen einzelnen überlangen Schritt nicht", () => {
    const cards = buildRecipeCards(
      recipe({ steps: ["x".repeat(4000), "danach kurz ruhen lassen"] }),
      "set",
    );
    const all = cards.map(textOf).join("\n");
    assert.match(all, /danach kurz ruhen lassen/);
  });

  it("kommt ohne Schritte zurecht", () => {
    const cards = buildRecipeCards(recipe({ steps: [] }), "set");
    assert.equal(cards.length, 2);
  });

  it("bleibt mit allen Elementen innerhalb der Kartenfläche", () => {
    for (const card of buildRecipeCards(recipe(), "set")) {
      for (const el of card.layoutSettings.elements ?? []) {
        assert.ok(el.x >= 0 && el.x + el.width <= 6.001, `x überläuft: ${el.id}`);
        assert.ok(el.y >= 0 && el.y + el.height <= 4.001, `y überläuft: ${el.id}`);
      }
    }
  });

  it("vergibt eindeutige Element-Kennungen über alle Karten", () => {
    const ids = buildRecipeCards(recipe(), "set").flatMap((card) =>
      (card.layoutSettings.elements ?? []).map((el) => el.id),
    );
    assert.equal(new Set(ids).size, ids.length);
  });
});
