import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  scatterGlyphsInPolygon,
  scatterGlyphsAlongPath,
  buildReliefShading,
} from "./terrain";
import { BiomeKind } from "./constants";
import type { Polygon, Path } from "./geometry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A unit square polygon [0,0] → [1,1]. */
const UNIT_SQUARE: Polygon = {
  type: "Polygon",
  rings: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

/** A small triangle polygon with known area ≈ 0.125. */
const SMALL_TRIANGLE: Polygon = {
  type: "Polygon",
  rings: [
    [
      [0.1, 0.1],
      [0.6, 0.1],
      [0.35, 0.6],
      [0.1, 0.1],
    ],
  ],
};

/** A horizontal ridge path. */
const RIDGE_PATH: Path = {
  type: "Path",
  coordinates: [
    [0.1, 0.5],
    [0.4, 0.5],
    [0.7, 0.5],
    [0.9, 0.5],
  ],
};

// ---------------------------------------------------------------------------
// scatterGlyphsInPolygon
// ---------------------------------------------------------------------------

describe("scatterGlyphsInPolygon / forest", () => {
  it("returns glyphs inside a unit-square forest polygon", () => {
    const items = scatterGlyphsInPolygon(UNIT_SQUARE, BiomeKind.forest, 1.0, 1337);
    assert.ok(items.length > 0, "should produce at least one glyph");
    for (const item of items) {
      assert.equal(item.glyphKey, "tree", "forest biome should use tree glyph");
      assert.ok(item.x >= 0 && item.x <= 1, "x must be in [0,1]");
      assert.ok(item.y >= 0 && item.y <= 1, "y must be in [0,1]");
      assert.ok(item.scale > 0, "scale must be positive");
    }
  });

  it("is deterministic — same seed → same result", () => {
    const a = scatterGlyphsInPolygon(UNIT_SQUARE, BiomeKind.forest, 1.0, 999);
    const b = scatterGlyphsInPolygon(UNIT_SQUARE, BiomeKind.forest, 1.0, 999);
    assert.deepEqual(a, b);
  });

  it("different seeds produce different placements", () => {
    const a = scatterGlyphsInPolygon(UNIT_SQUARE, BiomeKind.forest, 1.0, 1);
    const b = scatterGlyphsInPolygon(UNIT_SQUARE, BiomeKind.forest, 1.0, 2);
    // They should differ in at least some coordinate (extremely unlikely to collide)
    const sameX = a.every((item, i) => b[i] && item.x === b[i]!.x);
    assert.equal(sameX, false, "different seeds should give different x positions");
  });

  it("density=0 returns empty array", () => {
    const items = scatterGlyphsInPolygon(UNIT_SQUARE, BiomeKind.forest, 0, 1);
    assert.equal(items.length, 0);
  });

  it("density scales glyph count", () => {
    const low = scatterGlyphsInPolygon(UNIT_SQUARE, BiomeKind.forest, 0.2, 1337);
    const high = scatterGlyphsInPolygon(UNIT_SQUARE, BiomeKind.forest, 1.5, 1337);
    assert.ok(high.length > low.length, "higher density should produce more glyphs");
  });

  it("returns empty for grassland (no glyph)", () => {
    const items = scatterGlyphsInPolygon(UNIT_SQUARE, BiomeKind.grassland, 1.0, 1337);
    assert.equal(items.length, 0, "grassland has no associated glyph");
  });

  it("returns mountain glyphs for mountains biome", () => {
    const items = scatterGlyphsInPolygon(SMALL_TRIANGLE, BiomeKind.mountains, 1.0, 42);
    for (const item of items) {
      assert.equal(item.glyphKey, "mountain");
    }
  });

  it("returns mountain_snow glyphs for snow biome", () => {
    const items = scatterGlyphsInPolygon(UNIT_SQUARE, BiomeKind.snow, 1.0, 7);
    if (items.length > 0) {
      assert.equal(items[0]!.glyphKey, "mountain_snow");
    }
  });

  it("all IDs are unique within a single call", () => {
    const items = scatterGlyphsInPolygon(UNIT_SQUARE, BiomeKind.forest, 2.0, 1337);
    const ids = new Set(items.map((i) => i.id));
    assert.equal(ids.size, items.length, "all scatter IDs must be unique");
  });

  it("rotation is within ±10 degrees of origin (jitter range)", () => {
    const items = scatterGlyphsInPolygon(UNIT_SQUARE, BiomeKind.forest, 1.0, 1337);
    for (const item of items) {
      assert.ok(
        Math.abs(item.rotation) <= 10.01,
        `rotation ${item.rotation} must be within ±10°`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// scatterGlyphsInPolygon / edge cases
// ---------------------------------------------------------------------------

describe("scatterGlyphsInPolygon / edge cases", () => {
  it("handles a polygon with < 3 points gracefully (returns empty)", () => {
    const degenerate: Polygon = { type: "Polygon", rings: [[[0, 0], [1, 0]]] };
    const items = scatterGlyphsInPolygon(degenerate, BiomeKind.forest, 1.0, 1);
    assert.equal(items.length, 0);
  });

  it("handles a polygon with no rings gracefully (returns empty)", () => {
    const empty: Polygon = { type: "Polygon", rings: [] };
    const items = scatterGlyphsInPolygon(empty, BiomeKind.forest, 1.0, 1);
    assert.equal(items.length, 0);
  });

  it("scale is in expected jitter range [0.55, 1.15]", () => {
    const items = scatterGlyphsInPolygon(UNIT_SQUARE, BiomeKind.forest, 1.0, 1337);
    for (const item of items) {
      assert.ok(item.scale >= 0.5 && item.scale <= 1.2, `scale ${item.scale} out of range`);
    }
  });
});

// ---------------------------------------------------------------------------
// scatterGlyphsAlongPath
// ---------------------------------------------------------------------------

describe("scatterGlyphsAlongPath / mountains ridge", () => {
  it("returns mountain glyphs along a ridge path", () => {
    const items = scatterGlyphsAlongPath(RIDGE_PATH, BiomeKind.mountains, 0.15, undefined, 42);
    assert.ok(items.length > 0, "should produce glyphs along path");
    for (const item of items) {
      assert.equal(item.glyphKey, "mountain");
    }
  });

  it("is deterministic — same seed → same result", () => {
    const a = scatterGlyphsAlongPath(RIDGE_PATH, BiomeKind.mountains, 0.1, undefined, 999);
    const b = scatterGlyphsAlongPath(RIDGE_PATH, BiomeKind.mountains, 0.1, undefined, 999);
    assert.deepEqual(a, b);
  });

  it("different seeds produce different results", () => {
    const a = scatterGlyphsAlongPath(RIDGE_PATH, BiomeKind.mountains, 0.1, undefined, 1);
    const b = scatterGlyphsAlongPath(RIDGE_PATH, BiomeKind.mountains, 0.1, undefined, 2);
    const sameY = a.length === b.length && a.every((it, i) => b[i] && it.y === b[i]!.y);
    assert.equal(sameY, false, "different seeds should differ");
  });

  it("wider spacing → fewer glyphs", () => {
    const dense = scatterGlyphsAlongPath(RIDGE_PATH, BiomeKind.mountains, 0.05, undefined, 42);
    const sparse = scatterGlyphsAlongPath(RIDGE_PATH, BiomeKind.mountains, 0.2, undefined, 42);
    assert.ok(dense.length > sparse.length, "smaller spacing should produce more glyphs");
  });

  it("height metadata scales glyph scale", () => {
    const highMeta = [1.0, 1.0, 1.0, 1.0];
    const lowMeta = [0.0, 0.0, 0.0, 0.0];
    const highItems = scatterGlyphsAlongPath(RIDGE_PATH, BiomeKind.mountains, 0.1, highMeta, 42);
    const lowItems = scatterGlyphsAlongPath(RIDGE_PATH, BiomeKind.mountains, 0.1, lowMeta, 42);
    if (highItems.length > 0 && lowItems.length > 0) {
      const avgHigh = highItems.reduce((s, i) => s + i.scale, 0) / highItems.length;
      const avgLow = lowItems.reduce((s, i) => s + i.scale, 0) / lowItems.length;
      assert.ok(avgHigh > avgLow, "higher elevation should produce larger glyphs on average");
    }
  });

  it("returns empty for path with spacing=0", () => {
    const items = scatterGlyphsAlongPath(RIDGE_PATH, BiomeKind.mountains, 0, undefined, 42);
    assert.equal(items.length, 0);
  });

  it("returns empty for path with < 2 coordinates", () => {
    const short: Path = { type: "Path", coordinates: [[0.5, 0.5]] };
    const items = scatterGlyphsAlongPath(short, BiomeKind.mountains, 0.1, undefined, 42);
    assert.equal(items.length, 0);
  });

  it("all IDs are unique", () => {
    const items = scatterGlyphsAlongPath(RIDGE_PATH, BiomeKind.mountains, 0.05, undefined, 42);
    const ids = new Set(items.map((i) => i.id));
    assert.equal(ids.size, items.length);
  });
});

// ---------------------------------------------------------------------------
// buildReliefShading
// ---------------------------------------------------------------------------

describe("buildReliefShading", () => {
  it("returns a descriptor with the correct biomeKind", () => {
    const desc = buildReliefShading(UNIT_SQUARE, BiomeKind.mountains);
    assert.equal(desc.biomeKind, BiomeKind.mountains);
  });

  it("bbox matches the polygon bounding box", () => {
    const desc = buildReliefShading(UNIT_SQUARE, BiomeKind.mountains);
    assert.deepEqual(desc.bbox, [0, 0, 1, 1]);
  });

  it("returns non-empty highlight and shadow colours", () => {
    for (const kind of Object.values(BiomeKind)) {
      const desc = buildReliefShading(UNIT_SQUARE, kind);
      assert.ok(desc.highlightColor.length > 0, `${kind} must have highlightColor`);
      assert.ok(desc.shadowColor.length > 0, `${kind} must have shadowColor`);
    }
  });

  it("opacity is in [0, 1] for all biome kinds", () => {
    for (const kind of Object.values(BiomeKind)) {
      const desc = buildReliefShading(UNIT_SQUARE, kind);
      assert.ok(desc.opacity >= 0 && desc.opacity <= 1, `${kind} opacity out of range`);
    }
  });

  it("mountains has higher opacity than grassland", () => {
    const mountain = buildReliefShading(UNIT_SQUARE, BiomeKind.mountains);
    const grass = buildReliefShading(UNIT_SQUARE, BiomeKind.grassland);
    assert.ok(mountain.opacity > grass.opacity);
  });

  it("bbox respects a non-unit polygon", () => {
    const desc = buildReliefShading(SMALL_TRIANGLE, BiomeKind.hills);
    assert.ok(desc.bbox[0] >= 0.09 && desc.bbox[0] <= 0.11, "minX near 0.1");
    assert.ok(desc.bbox[1] >= 0.09 && desc.bbox[1] <= 0.11, "minY near 0.1");
  });

  it("is deterministic (pure function, no side effects)", () => {
    const a = buildReliefShading(UNIT_SQUARE, BiomeKind.forest);
    const b = buildReliefShading(UNIT_SQUARE, BiomeKind.forest);
    assert.deepEqual(a, b);
  });
});
