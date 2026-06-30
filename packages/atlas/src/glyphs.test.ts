import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ATLAS_GLYPH_CATEGORIES,
  BUILTIN_GLYPHS,
  BUILTIN_GLYPH_KEYS,
  getGlyphByKey,
  listGlyphsByCategory,
  groupGlyphsByCategory,
  type AtlasGlyphCategory,
} from "./glyphs";

const CATEGORY_KEYS = ATLAS_GLYPH_CATEGORIES.map((c) => c.key);

// Path commands the Canvas2D renderers actually implement (drawSvgPath).
const SUPPORTED_PATH_COMMANDS = /^[\s\d.,MLHVQCZ-]+$/;

describe("glyphs / registry integrity", () => {
  it("has unique keys", () => {
    const keys = BUILTIN_GLYPHS.map((g) => g.key);
    assert.equal(new Set(keys).size, keys.length, "glyph keys must be unique");
  });

  it("BUILTIN_GLYPH_KEYS mirrors the registry order", () => {
    assert.deepEqual(BUILTIN_GLYPH_KEYS, BUILTIN_GLYPHS.map((g) => g.key));
  });

  it("every glyph has name, valid category, pathData and color", () => {
    for (const glyph of BUILTIN_GLYPHS) {
      assert.ok(glyph.name.length > 0, `${glyph.key} needs a name`);
      assert.ok(
        CATEGORY_KEYS.includes(glyph.kind),
        `${glyph.key} has unknown category "${glyph.kind}"`,
      );
      assert.ok(glyph.pathData.length > 0, `${glyph.key} needs pathData`);
      assert.match(glyph.color, /^#[0-9a-fA-F]{6}$/, `${glyph.key} needs a hex color`);
    }
  });

  it("pathData uses only renderer-supported commands and starts with a move", () => {
    for (const glyph of BUILTIN_GLYPHS) {
      assert.match(
        glyph.pathData,
        SUPPORTED_PATH_COMMANDS,
        `${glyph.key} uses an unsupported path command`,
      );
      assert.equal(
        glyph.pathData.trim()[0],
        "M",
        `${glyph.key} pathData must start with an absolute moveto`,
      );
    }
  });
});

describe("glyphs / categories", () => {
  it("exposes exactly the relief, biome and pin categories", () => {
    assert.deepEqual([...CATEGORY_KEYS].sort(), ["biome", "pin", "relief"]);
  });

  it("has at least 4 added pictograms per category (>= original + 4)", () => {
    // Original baseline: relief 2, biome 2, pin 4. Requirement: +4 each.
    const minimums: Record<AtlasGlyphCategory, number> = {
      relief: 6,
      biome: 6,
      pin: 8,
    };
    for (const [kind, min] of Object.entries(minimums) as [
      AtlasGlyphCategory,
      number,
    ][]) {
      const count = listGlyphsByCategory(kind).length;
      assert.ok(
        count >= min,
        `category "${kind}" should have >= ${min} pictograms, got ${count}`,
      );
    }
  });

  it("groupGlyphsByCategory covers every glyph exactly once", () => {
    const grouped = groupGlyphsByCategory();
    const total = grouped.reduce((sum, g) => sum + g.glyphs.length, 0);
    assert.equal(total, BUILTIN_GLYPHS.length);
    assert.deepEqual(
      grouped.map((g) => g.category.key),
      CATEGORY_KEYS,
    );
  });
});

describe("glyphs / lookup helpers", () => {
  it("getGlyphByKey resolves known keys and ignores unknown/empty", () => {
    assert.equal(getGlyphByKey("mountain")?.name, "Berg");
    assert.equal(getGlyphByKey("tower")?.kind, "pin");
    assert.equal(getGlyphByKey("does-not-exist"), undefined);
    assert.equal(getGlyphByKey(null), undefined);
    assert.equal(getGlyphByKey(undefined), undefined);
  });

  it("keeps the original 8 builtin keys for backward compatibility", () => {
    for (const key of [
      "mountain",
      "mountain_snow",
      "tree",
      "city",
      "village",
      "ruin",
      "castle",
      "water",
    ]) {
      assert.ok(getGlyphByKey(key), `original glyph "${key}" must still exist`);
    }
  });
});
