import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeLookupKey, pickUniqueSlug, slugifyDe, slugifyKey } from "./slug-utils";

describe("slug-utils", () => {
  it("slugifies German titles with umlaut expansion", () => {
    assert.equal(slugifyDe("Magister-Turm von Validori"), "magister-turm-von-validori");
    assert.equal(slugifyDe("Über die Bärenhöhle!"), "ueber-die-baerenhoehle");
    assert.equal(slugifyDe("  Größe & Stärke  "), "groesse-staerke");
  });

  it("honours maxLength and fallback options", () => {
    assert.equal(slugifyDe("Eine sehr lange Überschrift", { maxLength: 10 }), "eine-sehr-");
    assert.equal(slugifyDe("***", { fallback: "entity" }), "entity");
    assert.equal(slugifyDe(""), "");
  });

  it("picks unique slugs with numbered suffixes", () => {
    assert.equal(pickUniqueSlug("validori", []), "validori");
    assert.equal(pickUniqueSlug("validori", ["validori"]), "validori-2");
    assert.equal(pickUniqueSlug("validori", ["validori", "validori-2"]), "validori-3");
    assert.equal(pickUniqueSlug("", []), "seite");
    assert.equal(pickUniqueSlug("", [], { fallback: "welt" }), "welt");
  });

  it("normalizes lookup keys case-insensitively", () => {
    assert.equal(normalizeLookupKey("  Über  "), "über");
    assert.equal(normalizeLookupKey("Validori"), "validori");
  });

  it("slugifies ASCII keys without umlaut expansion", () => {
    assert.equal(slugifyKey("Newsletter Gruppe!", "group"), "newsletter-gruppe");
    assert.equal(slugifyKey("###", "template"), "template");
    assert.equal(slugifyKey("Über", "fallback"), "ber");
  });
});
