import assert from "node:assert/strict";
import { test } from "node:test";
import { applyErosionBrush, erodeHeightmap } from "./erosion";
import { cloneHeightmap, createHeightmap, fbm, type HeightmapGrid } from "./planet-field";

/** Synthetic cone centered on the grid. */
function coneGrid(width = 64, height = 64): HeightmapGrid {
  const grid = createHeightmap(width, height);
  const cx = width / 2;
  const cy = height / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distance = Math.hypot(x - cx, y - cy);
      grid.data[y * width + x] = Math.max(0, 0.5 - distance / 20);
    }
  }
  return grid;
}

/** Deterministic noisy grid for brush tests. */
function noisyGrid(width = 64, height = 32): HeightmapGrid {
  const grid = createHeightmap(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      grid.data[y * width + x] = (fbm(x * 0.11, 0, y * 0.13, 7) - 0.5) * 0.4;
    }
  }
  return grid;
}

function maxNeighborDiff(grid: HeightmapGrid): number {
  let max = 0;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const h = grid.data[y * grid.width + x];
      const right = grid.data[y * grid.width + ((x + 1) % grid.width)];
      max = Math.max(max, Math.abs(h - right));
      if (y + 1 < grid.height) {
        max = Math.max(max, Math.abs(h - grid.data[(y + 1) * grid.width + x]));
      }
    }
  }
  return max;
}

function sum(data: Float32Array): number {
  let total = 0;
  for (const value of data) total += value;
  return total;
}

test("erodeHeightmap is deterministic", () => {
  const a = coneGrid();
  const b = coneGrid();
  const resultA = erodeHeightmap(a, { iterations: 12 });
  const resultB = erodeHeightmap(b, { iterations: 12 });
  assert.deepEqual(Array.from(a.data), Array.from(b.data), "same grid after two identical runs");
  assert.deepEqual(Array.from(resultA.flow), Array.from(resultB.flow), "same flow after two identical runs");
});

test("thermal erosion lowers the maximum slope of a cone", () => {
  const grid = coneGrid();
  const before = maxNeighborDiff(grid);
  erodeHeightmap(grid, { iterations: 30, incise: false });
  const after = maxNeighborDiff(grid);
  assert.ok(after < before, `slope shrinks (before ${before}, after ${after})`);
});

test("thermal erosion alone approximately conserves mass", () => {
  const grid = coneGrid();
  const before = sum(grid.data);
  erodeHeightmap(grid, { iterations: 25, incise: false });
  const after = sum(grid.data);
  assert.ok(Math.abs(after - before) < 1e-3, `mass conserved (delta ${Math.abs(after - before)})`);
});

test("erodeHeightmap returns a normalized flow mask", () => {
  const grid = coneGrid();
  const { flow } = erodeHeightmap(grid, { iterations: 10 });
  assert.equal(flow.length, grid.data.length, "flow covers the grid");
  let max = 0;
  for (const value of flow) {
    assert.ok(value >= 0 && value <= 1, "flow stays in 0..1");
    max = Math.max(max, value);
  }
  assert.equal(max, 1, "flow is normalized to a max of 1");
});

test("erosion brush changes only cells inside the radius", () => {
  const grid = noisyGrid();
  const before = cloneHeightmap(grid);
  const center: readonly [number, number] = [20, 14];
  const radius = 6;
  applyErosionBrush(grid, center, radius);
  let changed = 0;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const index = y * grid.width + x;
      if (grid.data[index] === before.data[index]) continue;
      changed++;
      let dx = Math.abs(x - center[0]);
      dx = Math.min(dx, grid.width - dx);
      const distance = Math.hypot(dx, y - center[1]);
      assert.ok(distance <= radius, `changed cell (${x},${y}) lies inside the brush`);
    }
  }
  assert.ok(changed > 0, "brush changes some cells");
});
