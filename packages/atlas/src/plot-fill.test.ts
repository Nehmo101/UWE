import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fillPlotWithGouacheAssets } from "./plot-fill";
import type { PlotFillObject, PlotFillOptions } from "./plot-fill";
import type { Polygon } from "./geometry";
import { hashStringToSeed } from "./prng";

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

// ---------------------------------------------------------------------------
// Golden regressions
//
// The digests below freeze the scatter output for fixed
// (polygon, options, seed) combinations: object count, per-gouache-key
// counts, and a checksum over every x/y/scale/rotation (rounded to 1e-6).
// Any unintended behavior change fails the deepEqual; identical seeds must
// keep reproducing the exact same digest. Update the digests only for
// deliberate generator changes.
// ---------------------------------------------------------------------------

function coordChecksum(values: readonly number[]): string {
  return hashStringToSeed(values.map((value) => value.toFixed(6)).join("|")).toString(16);
}

function plotDigest(objects: PlotFillObject[]) {
  const gouacheCounts: Record<string, number> = {};
  for (const object of objects) {
    gouacheCounts[object.style.gouache] = (gouacheCounts[object.style.gouache] ?? 0) + 1;
  }
  return {
    count: objects.length,
    gouacheCounts,
    coordChecksum: coordChecksum(
      objects.flatMap((object) => [object.x, object.y, object.scale, object.rotation]),
    ),
  };
}

function pointInRing(px: number, py: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

interface PlotGoldenCase {
  name: string;
  polygon: Polygon;
  options: PlotFillOptions;
  digest: ReturnType<typeof plotDigest>;
}

const PLOT_GOLDEN_CASES: PlotGoldenCase[] = [
  {
    name: "weighted mixed forest on the unit square (seed 42)",
    polygon: UNIT_SQUARE,
    options: {
      paletteItemId: "tree",
      seed: 42,
      density: 0.35,
      assets: [
        { gouacheKey: "g_oak", weight: 1 },
        { gouacheKey: "g_bush", weight: 3, scaleMin: 0.5, scaleMax: 0.7 },
      ],
    },
    digest: {
      count: 15,
      gouacheCounts: { g_bush: 12, g_oak: 3 },
      coordChecksum: "d8abedf",
    },
  },
  {
    name: "pine plot with hole and road exclusion (seed 7)",
    polygon: WITH_HOLE,
    options: {
      paletteItemId: "tree",
      seed: 7,
      density: 0.8,
      exclusions: [
        {
          path: [
            [0, 0.25],
            [1, 0.25],
          ],
          width: 0.16,
        },
      ],
      assets: [{ gouacheKey: "g_pine", lineWidth: 1.1 }],
    },
    digest: {
      count: 32,
      gouacheCounts: { g_pine: 32 },
      coordChecksum: "1a07f207",
    },
  },
];

describe("fillPlotWithGouacheAssets / golden regressions", () => {
  for (const golden of PLOT_GOLDEN_CASES) {
    it(`pins the ${golden.name} scatter`, () => {
      const objects = fillPlotWithGouacheAssets(golden.polygon, golden.options);
      assert.deepEqual(plotDigest(objects), golden.digest);

      const allowedKeys = new Set(golden.options.assets.map((asset) => asset.gouacheKey));
      const outer = golden.polygon.rings[0]! as [number, number][];
      const holes = golden.polygon.rings.slice(1) as [number, number][][];
      for (const object of objects) {
        assert.ok(allowedKeys.has(object.style.gouache), `${object.id}: unexpected gouache key`);
        assert.ok(pointInRing(object.x, object.y, outer), `${object.id}: outside the plot polygon`);
        for (const hole of holes) {
          assert.ok(!pointInRing(object.x, object.y, hole), `${object.id}: inside a hole`);
        }
        for (const exclusion of golden.options.exclusions ?? []) {
          for (let i = 0; i < exclusion.path.length - 1; i++) {
            const [ax, ay] = exclusion.path[i]!;
            const [bx, by] = exclusion.path[i + 1]!;
            const dx = bx - ax;
            const dy = by - ay;
            const lenSq = dx * dx + dy * dy;
            const t =
              lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((object.x - ax) * dx + (object.y - ay) * dy) / lenSq));
            const dist = Math.hypot(object.x - (ax + t * dx), object.y - (ay + t * dy));
            assert.ok(dist >= exclusion.width / 2, `${object.id}: inside an exclusion corridor`);
          }
        }
      }
    });
  }
});
