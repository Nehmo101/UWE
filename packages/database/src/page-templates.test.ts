import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPageTemplate,
  PAGE_TEMPLATES,
  pickUniqueSlug,
  slugifyPageTitle,
} from "./page-templates";

describe("page-templates", () => {
  it("provides templates for the core entity types", () => {
    const ids = PAGE_TEMPLATES.map((template) => template.id);

    for (const expected of ["blank", "npc", "ort", "fraktion", "quest", "session", "handout"]) {
      assert.ok(ids.includes(expected), `missing template: ${expected}`);
    }
  });

  it("has unique template ids", () => {
    const ids = PAGE_TEMPLATES.map((template) => template.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("only uses known block types", () => {
    const known = new Set(["rich_text", "html", "player_text", "statblock", "image", "handout"]);
    for (const template of PAGE_TEMPLATES) {
      for (const block of template.blocks) {
        assert.ok(known.has(block.type), `template ${template.id}: ${block.type}`);
      }
    }
  });

  it("resolves templates by id", () => {
    const npc = getPageTemplate("npc");
    assert.ok(npc);
    assert.equal(npc.pageType, "npc");
    assert.equal(getPageTemplate("does-not-exist"), null);
    assert.equal(getPageTemplate(null), null);
  });

  it("slugifies German titles", () => {
    assert.equal(slugifyPageTitle("Magister-Turm von Validori"), "magister-turm-von-validori");
    assert.equal(slugifyPageTitle("Über die Bärenhöhle!"), "ueber-die-baerenhoehle");
    assert.equal(slugifyPageTitle("  Größe & Stärke  "), "groesse-staerke");
  });

  it("picks unique slugs with numbered suffixes", () => {
    assert.equal(pickUniqueSlug("validori", []), "validori");
    assert.equal(pickUniqueSlug("validori", ["validori"]), "validori-2");
    assert.equal(pickUniqueSlug("validori", ["validori", "validori-2"]), "validori-3");
    assert.equal(pickUniqueSlug("", []), "seite");
  });
});
