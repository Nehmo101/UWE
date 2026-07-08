import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { riverFlowsUphill, snapPointToWater } from "./river-tools";

function layer(cells: Record<string, string>) {
  return { cols: 32, rows: 20, cells };
}

describe("snapPointToWater", () => {
  it("snaps to the nearest water cell centre within range", () => {
    // Water blob at cols 10-12, row 10.
    const cells: Record<string, string> = { "10,10": "coast", "11,10": "coast", "12,10": "coast" };
    // Point one cell east of the blob → nearest water centre is (12+0.5)/32.
    const p = snapPointToWater(layer(cells), [(13 + 0.5) / 32, (10 + 0.5) / 20], { maxDist: 0.06 });
    assert.ok(p, "snap target found");
    assert.ok(Math.abs(p![0] - (12 + 0.5) / 32) < 1e-9, `x snapped to nearest water, got ${p![0]}`);
    assert.ok(Math.abs(p![1] - (10 + 0.5) / 20) < 1e-9, `y snapped, got ${p![1]}`);
  });

  it("returns null when the point already lies in water", () => {
    const cells = { "10,10": "coast" };
    assert.equal(snapPointToWater(layer(cells), [(10 + 0.5) / 32, (10 + 0.5) / 20]), null);
  });

  it("returns null when no water is within maxDist", () => {
    const cells = { "0,0": "coast" };
    assert.equal(snapPointToWater(layer(cells), [0.9, 0.9], { maxDist: 0.05 }), null);
  });

  it("handles missing/empty layers gracefully", () => {
    assert.equal(snapPointToWater(null, [0.5, 0.5]), null);
    assert.equal(snapPointToWater(layer({}), [0.5, 0.5]), null);
  });

  it("is deterministic — same inputs, same snap", () => {
    const cells = { "5,5": "coast", "6,5": "coast" };
    const a = snapPointToWater(layer(cells), [0.22, 0.28], { maxDist: 0.1 });
    const b = snapPointToWater(layer(cells), [0.22, 0.28], { maxDist: 0.1 });
    assert.deepEqual(a, b);
  });
});

describe("riverFlowsUphill", () => {
  const grid = { cols: 32, rows: 20, elevation: { "2,10": 0.0, "29,10": 0.6 } };

  it("flags a river ending significantly higher than its start", () => {
    const coords: [number, number][] = [
      [(2 + 0.5) / 32, (10 + 0.5) / 20],
      [(29 + 0.5) / 32, (10 + 0.5) / 20],
    ];
    assert.equal(riverFlowsUphill(grid, coords), true);
  });

  it("accepts a downhill river and respects the threshold", () => {
    const downhill: [number, number][] = [
      [(29 + 0.5) / 32, (10 + 0.5) / 20],
      [(2 + 0.5) / 32, (10 + 0.5) / 20],
    ];
    assert.equal(riverFlowsUphill(grid, downhill), false);
    // Same uphill river passes with a generous threshold.
    const uphill = [...downhill].reverse() as [number, number][];
    assert.equal(riverFlowsUphill(grid, uphill, { threshold: 0.9 }), false);
  });

  it("returns false without an elevation grid or short paths", () => {
    assert.equal(riverFlowsUphill(null, [[0, 0], [1, 1]]), false);
    assert.equal(riverFlowsUphill({ cols: 32, rows: 20, elevation: null }, [[0, 0], [1, 1]]), false);
    assert.equal(riverFlowsUphill(grid, [[0.5, 0.5]]), false);
  });
});
