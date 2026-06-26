import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeLookupKey,
  pickUniqueSlug,
  slugifyAscii,
  slugifyDe,
  slugifyKey,
} from "./slug";

describe("shared-utils/slug", () => {
  it("slugifyDe expands umlauts", () => {
    assert.equal(slugifyDe("Magister-Turm von Validori"), "magister-turm-von-validori");
    assert.equal(slugifyDe("Über die Bärenhöhle!"), "ueber-die-baerenhoehle");
    assert.equal(slugifyDe("  Größe & Stärke  "), "groesse-staerke");
    assert.equal(slugifyDe("***", { fallback: "entity" }), "entity");
    assert.equal(slugifyDe("Eine sehr lange Überschrift", { maxLength: 10 }), "eine-sehr-");
  });

  it("slugifyAscii strips diacritics (no umlaut expansion)", () => {
    assert.equal(slugifyAscii("Über die Bärenhöhle!"), "uber-die-barenhohle");
    // ß is not decomposed by NFKD, so it drops out (matches the legacy importer).
    assert.equal(slugifyAscii("Größe"), "gro-e");
    assert.equal(slugifyAscii("a".repeat(80), { maxLength: 60 }).length, 60);
  });

  it("slugifyKey drops non-ASCII characters", () => {
    assert.equal(slugifyKey("Newsletter Gruppe!", "group"), "newsletter-gruppe");
    assert.equal(slugifyKey("###", "template"), "template");
    assert.equal(slugifyKey("Über", "fallback"), "ber");
  });

  it("pickUniqueSlug numbers collisions", () => {
    assert.equal(pickUniqueSlug("validori", []), "validori");
    assert.equal(pickUniqueSlug("validori", ["validori"]), "validori-2");
    assert.equal(pickUniqueSlug("validori", ["validori", "validori-2"]), "validori-3");
    assert.equal(pickUniqueSlug("", []), "seite");
    assert.equal(pickUniqueSlug("", [], { fallback: "import" }), "import");
  });

  it("pickUniqueSlug bounds candidates when maxLength is set", () => {
    const base = "a".repeat(60);
    const out = pickUniqueSlug(base, [base], { maxLength: 60 });
    assert.ok(out.length <= 60);
    assert.ok(out.endsWith("-2"));
  });

  it("normalizeLookupKey lowercases and trims", () => {
    assert.equal(normalizeLookupKey("  Über  "), "über");
    assert.equal(normalizeLookupKey("Validori"), "validori");
  });
});
