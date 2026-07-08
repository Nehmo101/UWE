import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findBridgePoints } from "./bridge-points";

describe("findBridgePoints", () => {
  it("finds a single crossing for perpendicular lines", () => {
    const road: [number, number][] = [
      [0, 0.5],
      [1, 0.5],
    ];
    const river: [number, number][] = [
      [0.5, 0],
      [0.5, 1],
    ];

    const points = findBridgePoints(road, river);
    assert.equal(points.length, 1);
    assert.ok(Math.abs(points[0]!.x - 0.5) < 1e-9);
    assert.ok(Math.abs(points[0]!.y - 0.5) < 1e-9);
    assert.ok(Math.abs(points[0]!.angleDeg - 0) < 1e-9, `angle should be ~0, got ${points[0]!.angleDeg}`);
  });

  it("returns [] for parallel, non-crossing lines", () => {
    const road: [number, number][] = [
      [0, 0.3],
      [1, 0.3],
    ];
    const river: [number, number][] = [
      [0, 0.7],
      [1, 0.7],
    ];

    assert.deepEqual(findBridgePoints(road, river), []);
  });

  it("returns [] for collinear (overlapping) lines", () => {
    const road: [number, number][] = [
      [0, 0.5],
      [1, 0.5],
    ];
    const river: [number, number][] = [
      [0.2, 0.5],
      [0.8, 0.5],
    ];

    assert.deepEqual(findBridgePoints(road, river), []);
  });

  it("orders multiple crossings along the road", () => {
    // A zig-zag river crosses a straight horizontal road three times, well
    // apart, at x = 0.2, 0.5, 0.8.
    const road: [number, number][] = [
      [0, 0.5],
      [1, 0.5],
    ];
    const river: [number, number][] = [
      [0.2, 0],
      [0.2, 1],
      [0.5, 1],
      [0.5, 0],
      [0.8, 0],
      [0.8, 1],
    ];

    const points = findBridgePoints(road, river);
    assert.equal(points.length, 3);
    assert.ok(Math.abs(points[0]!.x - 0.2) < 1e-9);
    assert.ok(Math.abs(points[1]!.x - 0.5) < 1e-9);
    assert.ok(Math.abs(points[2]!.x - 0.8) < 1e-9);
  });

  it("orders crossings along a road that runs the opposite direction", () => {
    const road: [number, number][] = [
      [1, 0.5],
      [0, 0.5],
    ];
    const river: [number, number][] = [
      [0.2, 0],
      [0.2, 1],
      [0.8, 1],
      [0.8, 0],
    ];

    const points = findBridgePoints(road, river);
    assert.equal(points.length, 2);
    // Road walks from x=1 toward x=0, so the 0.8 crossing comes first.
    assert.ok(Math.abs(points[0]!.x - 0.8) < 1e-9);
    assert.ok(Math.abs(points[1]!.x - 0.2) < 1e-9);
    assert.ok(Math.abs(points[0]!.angleDeg - 180) < 1e-9);
  });

  it("merges crossings closer than minGap, keeping the first", () => {
    const road: [number, number][] = [
      [0, 0.5],
      [1, 0.5],
    ];
    // Two river crossings 0.01 apart (< default minGap 0.02) should merge:
    // the river dips below the road at x=0.5 and comes back up at x=0.51.
    const river: [number, number][] = [
      [0.5, 0.4],
      [0.5, 0.6],
      [0.51, 0.6],
      [0.51, 0.4],
    ];

    const points = findBridgePoints(road, river);
    assert.equal(points.length, 1);
    assert.ok(Math.abs(points[0]!.x - 0.5) < 1e-9, "keeps the first (earlier along-road) crossing");
  });

  it("keeps crossings farther apart than minGap distinct", () => {
    const road: [number, number][] = [
      [0, 0.5],
      [1, 0.5],
    ];
    const river: [number, number][] = [
      [0.4, 0],
      [0.4, 1],
      [0.6, 1],
      [0.6, 0],
    ];

    const points = findBridgePoints(road, river, { minGap: 0.02 });
    assert.equal(points.length, 2);
  });

  it("honors a custom minGap", () => {
    const road: [number, number][] = [
      [0, 0.5],
      [1, 0.5],
    ];
    const river: [number, number][] = [
      [0.4, 0],
      [0.4, 1],
      [0.6, 1],
      [0.6, 0],
    ];

    // 0.4 and 0.6 crossings are 0.2 apart — a large minGap merges them.
    const merged = findBridgePoints(road, river, { minGap: 0.5 });
    assert.equal(merged.length, 1);
  });

  it("returns [] for a road or river with fewer than 2 points", () => {
    assert.deepEqual(findBridgePoints([[0.5, 0.5]], [[0, 0], [1, 1]]), []);
    assert.deepEqual(findBridgePoints([[0, 0], [1, 1]], [[0.5, 0.5]]), []);
    assert.deepEqual(findBridgePoints([], []), []);
  });

  it("is deterministic across repeated calls", () => {
    const road: [number, number][] = [
      [0, 0.1],
      [0.5, 0.5],
      [1, 0.9],
    ];
    const river: [number, number][] = [
      [0.3, 0],
      [0.3, 1],
      [0.7, 1],
      [0.7, 0],
    ];

    const a = findBridgePoints(road, river);
    const b = findBridgePoints(road, river);
    assert.deepEqual(a, b);
  });
});
