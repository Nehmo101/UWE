import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fillPlotWithGouacheAssets } from "./plot-fill";
import type { Polygon } from "./geometry";

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

const WITH_HOLE: Polygon = {
  type: "Polygon",
  rings: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
    [
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.4, 0.6],
      [0.4, 0.4],
    ],
  ],
};

describe("fillPlotWithGouacheAssets", () => {
  it("creates deterministic gouache objects inside a polygon", () => {
    const a = fillPlotWithGouacheAssets(UNIT_SQUARE, {
      paletteItemId: "tree",
      seed: 42,
      density: 0.2,
      assets: [{ gouacheKey: "g_oak", lineWidth: 1.4 }],
    });
    const b = fillPlotWithGouacheAssets(UNIT_SQUARE, {
      paletteItemId: "tree",
      seed: 42,
      density: 0.2,
      assets: [{ gouacheKey: "g_oak", lineWidth: 1.4 }],
    });

    assert.ok(a.length > 0);
    assert.deepEqual(a, b);
    for (const obj of a) {
      assert.equal(obj.paletteItemId, "tree");
      assert.equal(obj.style.gouache, "g_oak");
      assert.equal(obj.style.lineWidth, 1.4);
      assert.ok(obj.x >= 0 && obj.x <= 1);
      assert.ok(obj.y >= 0 && obj.y <= 1);
      assert.ok(obj.scale >= 0.78 && obj.scale <= 1.22);
      assert.ok(obj.rotation >= -12 && obj.rotation <= 12);
    }
  });

  it("keeps holes and exclusion corridors clear", () => {
    const road = {
      path: [
        [0, 0.25],
        [1, 0.25],
      ] as [number, number][],
      width: 0.16,
    };
    const objects = fillPlotWithGouacheAssets(WITH_HOLE, {
      paletteItemId: "tree",
      seed: 7,
      density: 1,
      exclusions: [road],
      assets: [{ gouacheKey: "g_pine" }],
    });

    assert.ok(objects.length > 0);
    for (const obj of objects) {
      assert.ok(obj.x < 0.4 || obj.x > 0.6 || obj.y < 0.4 || obj.y > 0.6);
      assert.ok(Math.abs(obj.y - 0.25) >= road.width / 2);
    }
  });

  it("supports weighted multi-asset plots", () => {
    const objects = fillPlotWithGouacheAssets(UNIT_SQUARE, {
      paletteItemId: "tree",
      seed: 99,
      density: 0.6,
      assets: [
        { gouacheKey: "g_oak", weight: 1 },
        { gouacheKey: "g_bush", weight: 3, scaleMin: 0.5, scaleMax: 0.7 },
      ],
    });
    const keys = new Set(objects.map((obj) => obj.style.gouache));

    assert.ok(keys.has("g_oak"));
    assert.ok(keys.has("g_bush"));
  });

  it("returns empty for invalid input", () => {
    assert.deepEqual(
      fillPlotWithGouacheAssets(UNIT_SQUARE, {
        paletteItemId: "tree",
        density: 0,
        assets: [{ gouacheKey: "g_oak" }],
      }),
      [],
    );
    assert.deepEqual(
      fillPlotWithGouacheAssets(UNIT_SQUARE, {
        paletteItemId: "tree",
        assets: [],
      }),
      [],
    );
  });
});
