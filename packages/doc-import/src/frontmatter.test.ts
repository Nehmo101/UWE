import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asList,
  asScalar,
  normalizeFrontmatterKey,
  parseFrontmatterLines,
  splitFrontmatter,
} from "./frontmatter";

describe("normalizeFrontmatterKey", () => {
  it("folds case, umlauts, underscores and spaces onto one key", () => {
    assert.equal(normalizeFrontmatterKey("Siehe_Auch"), "siehe-auch");
    assert.equal(normalizeFrontmatterKey("siehe auch"), "siehe-auch");
    assert.equal(normalizeFrontmatterKey("SIEHE-AUCH"), "siehe-auch");
    assert.equal(normalizeFrontmatterKey("Hälfte"), "haelfte");
  });
});

describe("parseFrontmatterLines", () => {
  it("reads scalars, inline lists and multi-line lists", () => {
    const values = parseFrontmatterLines([
      "titel: Pellar Hopsenried",
      "kampagnen: [Turm, Himmelsrouten]",
      "tags:",
      "  - nsc",
      "  - ort/ferlor",
      "# ein Kommentar",
      "leer:",
    ]);

    assert.equal(values.titel, "Pellar Hopsenried");
    assert.deepEqual(values.kampagnen, ["Turm", "Himmelsrouten"]);
    assert.deepEqual(values.tags, ["nsc", "ort/ferlor"]);
    assert.deepEqual(values.leer, []);
  });

  it("keeps commas that sit inside quotes", () => {
    const values = parseFrontmatterLines(['quelle: ["Weltkanon §Teil X, Absatz 3", Himmelsrouten]']);
    assert.deepEqual(values.quelle, ["Weltkanon §Teil X, Absatz 3", "Himmelsrouten"]);
  });

  it("strips surrounding quotes from scalars", () => {
    const values = parseFrontmatterLines(['titel: "Der Zaunkönig"', "typ: 'nsc'"]);
    assert.equal(values.titel, "Der Zaunkönig");
    assert.equal(values.typ, "nsc");
  });
});

describe("splitFrontmatter", () => {
  it("splits a leading block from the body", () => {
    const { values, body, present } = splitFrontmatter(
      ["---", "titel: Ferlor", "typ: ort", "---", "", "# Ferlor", "", "Ein Dorf."].join("\n"),
    );

    assert.equal(present, true);
    assert.equal(values.titel, "Ferlor");
    assert.equal(body, "# Ferlor\n\nEin Dorf.");
  });

  it("treats a mid-document rule as a horizontal rule, not frontmatter", () => {
    const source = "# Titel\n\n---\n\ntyp: ort\n";
    const { present, body } = splitFrontmatter(source);

    assert.equal(present, false);
    assert.equal(body, source.trim());
  });

  it("keeps the whole document when the closing fence is missing", () => {
    const source = "---\ntitel: Kaputt\n\n# Weiter geht es\n";
    const { present, values } = splitFrontmatter(source);

    assert.equal(present, false);
    assert.deepEqual(values, {});
  });
});

describe("asList / asScalar", () => {
  it("reads a scalar as a one-element list and a list as its first entry", () => {
    assert.deepEqual(asList("Turm"), ["Turm"]);
    assert.deepEqual(asList("Turm, Himmelsrouten"), ["Turm", "Himmelsrouten"]);
    assert.deepEqual(asList(["a", " b "]), ["a", "b"]);
    assert.equal(asScalar(["Turm", "Himmelsrouten"]), "Turm");
    assert.equal(asScalar("  "), undefined);
  });
});
