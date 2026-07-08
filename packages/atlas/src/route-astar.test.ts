import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { routeRoad } from "./route-astar";
import type { AtlasTileLayer } from "./doc";

function layer(cells: Record<string, string> = {}): AtlasTileLayer {
  return { cols: 32, rows: 20, tile: 32, cells };
}

/** Vertical water wall at column `col`, optionally leaving a gap row. */
function wall(col: number, gapRow?: number): Record<string, string> {
  const cells: Record<string, string> = {};
  for (let r = 0; r < 20; r++) {
    if (r === gapRow) continue;
    cells[`${col},${r}`] = "water";
  }
  return cells;
}

describe("routeRoad", () => {
  it("routes across an empty layer and stays deterministic", () => {
    const a = routeRoad(layer(), [0.1, 0.5], [0.9, 0.5]);
    const b = routeRoad(layer(), [0.1, 0.5], [0.9, 0.5]);
    assert.ok(a.reachable, "reachable on flat ground");
    assert.ok(a.points.length >= 2);
    assert.ok(Math.abs(a.points[0]![0] - 0.1) < 0.06, "starts near start");
    assert.ok(Math.abs(a.points[a.points.length - 1]![0] - 0.9) < 0.06, "ends near goal");
    assert.deepEqual(a, b, "same inputs ⇒ identical result");
  });

  it("passes through a gap in a water wall", () => {
    const gapRow = 3;
    const res = routeRoad(layer(wall(16, gapRow)), [0.1, 0.75], [0.9, 0.75]);
    assert.ok(res.reachable, "gap makes the goal reachable");
    // Some waypoint must cross the wall column near the gap row.
    const nearGap = res.points.some(
      ([x, y]) => Math.abs(x - (16 + 0.5) / 32) < 2 / 32 && Math.abs(y - (gapRow + 0.5) / 20) < 3 / 20,
    );
    assert.ok(nearGap, "route squeezes through the gap");
  });

  it("reports unreachable across a full water wall", () => {
    const res = routeRoad(layer(wall(16)), [0.1, 0.5], [0.9, 0.5]);
    assert.equal(res.reachable, false);
    assert.deepEqual(res.points, []);
  });

  it("avoids expensive biomes when a cheap detour exists", () => {
    // Mountain band across the middle with free rows at top/bottom.
    const cells: Record<string, string> = {};
    for (let c = 8; c < 24; c++) for (let r = 8; r < 12; r++) cells[`${c},${r}`] = "mountains";
    const res = routeRoad(layer(cells), [0.05, 0.5], [0.95, 0.5]);
    assert.ok(res.reachable);
    const touchesMountain = res.points.some(([x, y]) => {
      const c = Math.floor(x * 32), r = Math.floor(y * 20);
      return cells[`${c},${r}`] === "mountains";
    });
    assert.equal(touchesMountain, false, "detours around the mountain band");
  });

  it("snaps a start point inside a small lake to the nearby shore", () => {
    // 3×3 water blob around the start — snapping to any edge keeps the goal
    // reachable (a full wall would split the map regardless of snapping).
    const cells: Record<string, string> = {};
    for (let c = 1; c <= 3; c++) for (let r = 9; r <= 11; r++) cells[`${c},${r}`] = "water";
    const res = routeRoad(layer(cells), [(2 + 0.5) / 32, (10 + 0.5) / 20], [0.9, 0.5]);
    assert.ok(res.reachable, "start snapped to passable neighbor");
  });
});
