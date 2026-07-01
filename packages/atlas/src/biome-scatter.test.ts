import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BiomeKind } from "./constants";
import { BIOME_SCATTER_GLYPH, BUILTIN_GLYPH_KEYS, getGlyphByKey } from "./glyphs";

describe("Canvas-of-Kings glyph additions", () => {
  it("registers rock, tent, stall, wall and gate", () => {
    for (const key of ["rock", "tent", "stall", "wall", "gate"]) {
      const glyph = getGlyphByKey(key);
      assert.ok(glyph, `glyph "${key}" must be registered`);
      assert.ok(glyph.pathData.length > 0, `glyph "${key}" must have pathData`);
    }
  });
});

describe("BIOME_SCATTER_GLYPH", () => {
  it("maps every biome kind", () => {
    for (const biome of Object.values(BiomeKind)) {
      assert.ok(biome in BIOME_SCATTER_GLYPH, `missing scatter mapping for "${biome}"`);
    }
  });

  it("references only valid glyph keys (or null)", () => {
    const keys = new Set(BUILTIN_GLYPH_KEYS);
    for (const [biome, glyphKey] of Object.entries(BIOME_SCATTER_GLYPH)) {
      if (glyphKey === null) continue;
      assert.ok(keys.has(glyphKey), `biome "${biome}" → unknown glyph "${glyphKey}"`);
    }
  });

  it("does not scatter over open water (coast → null)", () => {
    assert.equal(BIOME_SCATTER_GLYPH.coast, null);
  });
});
