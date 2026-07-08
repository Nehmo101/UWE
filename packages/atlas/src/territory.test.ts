import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { centroid } from "./geometry";
import { suggestTerritories, type TerritoryRegion } from "./territory";

function bbox(ring: [number, number][]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function assertRingWellFormed(region: TerritoryRegion): void {
  assert.ok(region.ring.length >= 4, `${region.key}: ring should have >= 4 points`);
  for (const [x, y] of region.ring) {
    assert.ok(x >= 0 && x <= 1, `${region.key}: x=${x} within [0,1]`);
    assert.ok(y >= 0 && y <= 1, `${region.key}: y=${y} within [0,1]`);
  }
  // Ring convention (matches scripts/atlas-cok-demo-seed.ts): closed, first
  // point repeated at the end.
  const first = region.ring[0]!;
  const last = region.ring[region.ring.length - 1]!;
  assert.deepEqual(first, last, `${region.key}: ring should be closed (first === last)`);
}

describe("suggestTerritories", () => {
  it("splits two left/right seeds into balanced regions on their own side", () => {
    const regions = suggestTerritories([
      { key: "left", x: 0.25, y: 0.5 },
      { key: "right", x: 0.75, y: 0.5 },
    ]);
    assert.equal(regions.length, 2);
    const left = regions.find((r) => r.key === "left")!;
    const right = regions.find((r) => r.key === "right")!;
    assert.ok(left && right);

    assertRingWellFormed(left);
    assertRingWellFormed(right);

    const leftCentroid = centroid(left.ring);
    const rightCentroid = centroid(right.ring);
    assert.ok(leftCentroid[0] < 0.5, `left centroid.x=${leftCentroid[0]} should be < 0.5`);
    assert.ok(rightCentroid[0] > 0.5, `right centroid.x=${rightCentroid[0]} should be > 0.5`);

    // Grid is symmetric (seeds at 0.25/0.75, samplesX=96 splits evenly at 0.5)
    // so sample counts should be exactly balanced.
    const diff = Math.abs(left.sampleCount - right.sampleCount);
    assert.ok(
      diff <= left.sampleCount * 0.05,
      `sampleCounts should be roughly balanced: left=${left.sampleCount} right=${right.sampleCount}`,
    );
    assert.ok(left.sampleCount > 0 && right.sampleCount > 0);
  });

  it("shifts the boundary toward a lighter seed when the other seed is weighted heavier", () => {
    const baseline = suggestTerritories([
      { key: "left", x: 0.25, y: 0.5 },
      { key: "right", x: 0.75, y: 0.5 },
    ]);
    const weighted = suggestTerritories([
      { key: "left", x: 0.25, y: 0.5 },
      { key: "right", x: 0.75, y: 0.5, weight: 3 },
    ]);

    const baseRight = baseline.find((r) => r.key === "right")!;
    const weightedLeft = weighted.find((r) => r.key === "left")!;
    const weightedRight = weighted.find((r) => r.key === "right")!;

    assert.ok(
      weightedRight.sampleCount > baseRight.sampleCount,
      "heavier seed should claim more samples than its unweighted baseline",
    );
    assert.ok(
      weightedRight.sampleCount > weightedLeft.sampleCount,
      "heavier seed should out-claim its lighter neighbour",
    );
  });

  it("is deterministic for identical inputs", () => {
    const seeds = [
      { key: "a", x: 0.2, y: 0.3 },
      { key: "b", x: 0.7, y: 0.25, weight: 1.4 },
      { key: "c", x: 0.5, y: 0.8 },
    ];
    const first = suggestTerritories(seeds);
    const second = suggestTerritories(seeds);
    assert.deepEqual(first, second);
  });

  it("covers ~the full map for a single seed", () => {
    const regions = suggestTerritories([{ key: "solo", x: 0.5, y: 0.5 }]);
    assert.equal(regions.length, 1);
    const solo = regions[0]!;
    assertRingWellFormed(solo);
    const [minX, minY, maxX, maxY] = bbox(solo.ring);
    assert.equal(minX, 0);
    assert.equal(minY, 0);
    assert.equal(maxX, 1);
    assert.equal(maxY, 1);
    assert.equal(solo.sampleCount, 96 * 60);
  });

  it("reduces sampleCount when an exclude mask removes samples", () => {
    const withoutMask = suggestTerritories([{ key: "solo", x: 0.5, y: 0.5 }]);
    const withMask = suggestTerritories([{ key: "solo", x: 0.5, y: 0.5 }], {
      exclude: (x) => x > 0.5,
    });
    assert.ok(withMask[0]!.sampleCount < withoutMask[0]!.sampleCount);
    assertRingWellFormed(withMask[0]!);
  });

  it("produces well-formed rings (>=4 points, within [0,1]^2) for every seed", () => {
    const regions = suggestTerritories([
      { key: "a", x: 0.15, y: 0.2 },
      { key: "b", x: 0.85, y: 0.2 },
      { key: "c", x: 0.5, y: 0.85 },
    ]);
    assert.equal(regions.length, 3);
    for (const region of regions) {
      assertRingWellFormed(region);
      assert.ok(region.sampleCount > 0);
    }
  });

  it("clamps out-of-range seeds into [0,1] instead of crashing", () => {
    const regions = suggestTerritories([
      { key: "off", x: -3, y: 5 },
      { key: "on", x: 0.5, y: 0.5 },
    ]);
    assert.equal(regions.length, 2);
    for (const region of regions) {
      if (region.sampleCount === 0) continue;
      assertRingWellFormed(region);
    }
  });

  it("returns an empty list for no seeds", () => {
    assert.deepEqual(suggestTerritories([]), []);
  });
});
