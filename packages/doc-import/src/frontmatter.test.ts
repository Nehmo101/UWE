import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asList,
  asScalar,
  isUnsafeFrontmatterKey,
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

  it("never turns a document key into a prototype property", () => {
    // `slugifyDe` macht aus `__proto__` heute `proto`; die Sperre steht trotzdem,
    // weil die Slug-Funktion einem anderen Package gehört.
    const values = parseFrontmatterLines([
      "__proto__: {}",
      "constructor: kaputt",
      "prototype: auch",
      "titel: Echt",
    ]);

    // `hasOwn`, nicht `values.constructor`: das erbt sonst von `Object.prototype`
    // und wäre auch dann gesetzt, wenn die Sperre greift.
    assert.equal(Object.hasOwn(values, "constructor"), false);
    assert.equal(Object.hasOwn(values, "prototype"), false);
    // `__proto__` landet als harmloses `proto` — der Slug hat die Unterstriche
    // schon weggenommen, bevor die Sperre überhaupt gefragt wird.
    assert.equal(values.proto, "{}");
    assert.equal(values.titel, "Echt");
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  });
});

describe("isUnsafeFrontmatterKey", () => {
  it("names the three keys that must never become properties", () => {
    for (const key of ["__proto__", "constructor", "prototype"]) {
      assert.equal(isUnsafeFrontmatterKey(key), true, key);
    }
    for (const key of ["titel", "typ", "proto", "siehe-auch"]) {
      assert.equal(isUnsafeFrontmatterKey(key), false, key);
    }
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
