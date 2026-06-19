import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMaterialsForForm,
  parseColorsFromForm,
  parseLinksFromForm,
  parseMaterialsFromForm,
  parsePhotosFromForm,
} from "./workshop-form-utils";
import { asMaterialList, countMaterialsNeeded } from "./workshop-types";

describe("workshop types and form utils", () => {
  it("parses materials with acquisition flag", () => {
    const parsed = parseMaterialsFromForm("XPS | 2 Platten | nein\nKleber | 1 | ja");
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]?.acquired, false);
    assert.equal(parsed[1]?.acquired, true);
    assert.deepEqual(countMaterialsNeeded(parsed), { total: 2, missing: 1 });
  });

  it("round-trips materials through form formatters", () => {
    const input = [{ name: "Foam", quantity: "1", acquired: false }];
    const formatted = formatMaterialsForForm(input);
    assert.equal(formatted, "Foam | 1 | nein");
    assert.deepEqual(asMaterialList(parseMaterialsFromForm(formatted)), input);
  });

  it("parses colors, links and photos", () => {
    const colors = parseColorsFromForm("Citadel: Macragge Blue (9918)");
    assert.equal(colors[0]?.brand, "Citadel");
    assert.equal(colors[0]?.code, "9918");

    const links = parseLinksFromForm("MyMiniFactory | https://example.com/a.stl | stl");
    assert.equal(links[0]?.kind, "stl");

    const photos = parsePhotosFromForm("https://img.test/a.jpg | Basecoat fertig");
    assert.equal(photos[0]?.caption, "Basecoat fertig");
  });
});
