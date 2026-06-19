import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFilamentLabelContent,
  buildWorkshopLabelContent,
  resolveFilamentLabelTemplateSlug,
  resolveWorkshopLabelTemplateSlug,
} from "./label-workshop-service";

describe("label workshop service", () => {
  it("resolves workshop label template slugs", () => {
    assert.equal(resolveWorkshopLabelTemplateSlug("miniature"), "miniature-box");
    assert.equal(resolveWorkshopLabelTemplateSlug("dnd_terrain"), "terrain-box");
    assert.equal(resolveWorkshopLabelTemplateSlug("printing_3d"), "3d-print-project");
    assert.equal(resolveFilamentLabelTemplateSlug(), "filament-spool");
  });

  it("builds workshop label content with materials and QR", () => {
    const content = buildWorkshopLabelContent(
      {
        title: "Forest Ruins Tile",
        projectType: "dnd_terrain",
        description: "Modular forest ruins",
        materialsNeeded: [{ name: "XPS foam", quantity: "2" }],
        filamentsUsed: null,
        notes: "Paint with woodland scheme",
        nextAction: "Drybrush highlights",
      },
      { pageUrl: "https://uwe.local/worlds/terra/forest-ruins" },
    );

    assert.equal(content.title, "Forest Ruins Tile");
    assert.match(content.text ?? "", /XPS foam/);
    assert.ok(content.elements?.some((element) => element.type === "qr"));
  });

  it("builds filament label content", () => {
    const content = buildFilamentLabelContent({
      brand: "Prusament",
      material: "PLA",
      color: "Matte Black",
      weightGrams: 850,
    });

    assert.match(content.title, /Prusament/);
    assert.match(content.text ?? "", /Matte Black/);
  });
});
