import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRecipeFormatContext, parseRecipeFormat } from "./ai-recipe-format";
import type { RecipeCardInput } from "./recipe-card-layout";

const recipe: RecipeCardInput = {
  title: "Tomatensauce",
  servingsBase: 4,
  durationMinutes: 30,
  ingredients: [
    { name: "Tomaten", amount: 800, unitLabel: "g" },
    { name: "Salz" },
  ],
  steps: ["Zwiebeln anbraten", "Tomaten dazu"],
};

describe("buildRecipeFormatContext", () => {
  it("nennt Titel, Portionen und Dauer", () => {
    const context = buildRecipeFormatContext(recipe);

    assert.match(context, /Rezept: Tomatensauce/);
    assert.match(context, /Portionen: 4/);
    assert.match(context, /Dauer: 30 Minuten/);
  });

  it("listet Zutaten mit Menge und Einheit", () => {
    const context = buildRecipeFormatContext(recipe);

    assert.match(context, /- 800 g Tomaten/);
    assert.match(context, /- Salz/);
  });

  it("nummeriert die Arbeitsschritte", () => {
    const context = buildRecipeFormatContext(recipe);

    assert.match(context, /1\. Zwiebeln anbraten/);
    assert.match(context, /2\. Tomaten dazu/);
  });

  it("sagt ausdrücklich, dass keine Schritte hinzukommen dürfen", () => {
    assert.match(buildRecipeFormatContext(recipe), /niemals mehr/);
  });

  it("lässt fehlende Angaben weg, statt Platzhalter zu schreiben", () => {
    const context = buildRecipeFormatContext({
      ...recipe,
      servingsBase: null,
      durationMinutes: null,
    });

    assert.doesNotMatch(context, /Portionen:/);
    assert.doesNotMatch(context, /Dauer:/);
  });
});

describe("parseRecipeFormat", () => {
  it("liest saubere JSON-Antworten", () => {
    const result = parseRecipeFormat('{"steps":["Zwiebeln anbraten","Tomaten dazu"],"note":"geht auch mit Dosen"}');

    assert.equal(result.status, "ok");
    assert.deepEqual(result.status === "ok" ? result.draft.steps : [], [
      "Zwiebeln anbraten",
      "Tomaten dazu",
    ]);
    assert.equal(result.status === "ok" ? result.draft.note : "", "geht auch mit Dosen");
  });

  it("verträgt Text vor und nach dem JSON", () => {
    const result = parseRecipeFormat('Gerne! ```json\n{"steps":["Anbraten"]}\n``` Fertig.');
    assert.equal(result.status, "ok");
  });

  it("lässt die Notiz weg, wenn sie leer ist", () => {
    const result = parseRecipeFormat('{"steps":["Anbraten"],"note":"  "}');
    assert.equal(result.status === "ok" ? result.draft.note : "x", undefined);
  });

  it("meldet leere Antworten als Parse-Fehler", () => {
    assert.equal(parseRecipeFormat("   ").status, "parse_error");
  });

  it("meldet fehlendes JSON als Parse-Fehler", () => {
    assert.equal(parseRecipeFormat("Tut mir leid, das kann ich nicht.").status, "parse_error");
  });

  it("meldet kaputtes JSON als Parse-Fehler", () => {
    assert.equal(parseRecipeFormat('{"steps": [').status, "parse_error");
  });

  it("meldet eine Antwort ohne Schritte als Parse-Fehler", () => {
    assert.equal(parseRecipeFormat('{"steps":[],"note":"nix"}').status, "parse_error");
    assert.equal(parseRecipeFormat('{"note":"nix"}').status, "parse_error");
  });

  it("wirft leere Schritte aus der Liste", () => {
    const result = parseRecipeFormat('{"steps":["Anbraten","","  ","Wenden"]}');
    assert.deepEqual(result.status === "ok" ? result.draft.steps : [], ["Anbraten", "Wenden"]);
  });

  it("ignoriert Nicht-Text in der Schrittliste", () => {
    const result = parseRecipeFormat('{"steps":["Anbraten",42,null,"Wenden"]}');
    assert.deepEqual(result.status === "ok" ? result.draft.steps : [], ["Anbraten", "Wenden"]);
  });
});
