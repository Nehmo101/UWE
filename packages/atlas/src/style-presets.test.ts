import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TOLKIEN_INK,
  STYLE_PRESETS,
  resolveStylePreset,
  type AtlasStylePreset,
} from "./style-presets";

// ---------------------------------------------------------------------------
// Tolkien-Ink preset snapshot
// ---------------------------------------------------------------------------

describe("style-presets / tolkien-ink snapshot", () => {
  it("has the correct id and label", () => {
    assert.equal(TOLKIEN_INK.id, "tolkien-ink");
    assert.equal(TOLKIEN_INK.label, "Tolkien Ink");
  });

  it("parchment color is correct hex", () => {
    assert.equal(TOLKIEN_INK.colors.parchment, "#f2e8c9");
  });

  it("ink color is near-black", () => {
    assert.equal(TOLKIEN_INK.colors.ink, "#1a1008");
  });

  it("inkAccent is red", () => {
    assert.equal(TOLKIEN_INK.colors.inkAccent, "#8b1a10");
  });

  it("has compass rose and scale bar enabled", () => {
    assert.equal(TOLKIEN_INK.decorations.compassRose, true);
    assert.equal(TOLKIEN_INK.decorations.scaleBar, true);
  });

  it("scale unit is leagues", () => {
    assert.equal(TOLKIEN_INK.decorations.scaleUnit, "leagues");
  });

  it("compass offset is 0 degrees", () => {
    assert.equal(TOLKIEN_INK.decorations.compassOffsetDeg, 0);
  });

  it("lineWeightScale is 1.0", () => {
    assert.equal(TOLKIEN_INK.decorations.lineWeightScale, 1.0);
  });

  it("labelRegion font stack contains Uncial Antiqua", () => {
    assert.ok(TOLKIEN_INK.typography.labelRegion.includes("Uncial Antiqua"));
  });

  it("baseSizePx is a positive number", () => {
    assert.ok(TOLKIEN_INK.typography.baseSizePx > 0);
  });
});

// ---------------------------------------------------------------------------
// STYLE_PRESETS registry
// ---------------------------------------------------------------------------

describe("style-presets / registry", () => {
  it("tolkien-ink is registered", () => {
    assert.ok("tolkien-ink" in STYLE_PRESETS);
    assert.deepStrictEqual(STYLE_PRESETS["tolkien-ink"], TOLKIEN_INK);
  });

  it("all registered presets satisfy the AtlasStylePreset shape", () => {
    const requiredColorKeys: (keyof AtlasStylePreset["colors"])[] = [
      "parchment",
      "ink",
      "inkAccent",
      "water",
      "land",
      "forest",
      "mountain",
      "road",
    ];
    const requiredTypographyKeys: (keyof AtlasStylePreset["typography"])[] = [
      "labelRegion",
      "labelCity",
      "title",
      "baseSizePx",
    ];

    for (const [id, preset] of Object.entries(STYLE_PRESETS)) {
      assert.equal(typeof preset.id, "string", `${id}: id must be string`);
      assert.equal(typeof preset.label, "string", `${id}: label must be string`);
      assert.equal(typeof preset.description, "string", `${id}: description must be string`);

      for (const key of requiredColorKeys) {
        assert.equal(
          typeof preset.colors[key],
          "string",
          `${id}: colors.${key} must be string`,
        );
      }
      for (const key of requiredTypographyKeys) {
        assert.ok(
          preset.typography[key] !== undefined,
          `${id}: typography.${key} must be defined`,
        );
      }

      assert.equal(
        typeof preset.decorations.compassRose,
        "boolean",
        `${id}: decorations.compassRose must be boolean`,
      );
      assert.equal(
        typeof preset.decorations.scaleBar,
        "boolean",
        `${id}: decorations.scaleBar must be boolean`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// resolveStylePreset
// ---------------------------------------------------------------------------

describe("style-presets / resolveStylePreset", () => {
  it("returns tolkien-ink for unknown id", () => {
    assert.deepStrictEqual(resolveStylePreset("no-such-preset"), TOLKIEN_INK);
  });

  it("returns tolkien-ink for null", () => {
    assert.deepStrictEqual(resolveStylePreset(null), TOLKIEN_INK);
  });

  it("returns tolkien-ink for undefined", () => {
    assert.deepStrictEqual(resolveStylePreset(undefined), TOLKIEN_INK);
  });

  it("returns the correct preset for a known id", () => {
    assert.deepStrictEqual(resolveStylePreset("tolkien-ink"), TOLKIEN_INK);
  });
});
