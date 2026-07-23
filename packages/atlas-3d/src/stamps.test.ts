import assert from "node:assert/strict";
import { test } from "node:test";
import { createHeightmap, sampleHeightmap } from "./planet-field";
import { applyGlobeStamp, applyPlanarStamp, TERRAIN_STAMPS } from "./stamps";

test("crater stamp lowers the center and raises the rim (globe)", () => {
  const grid = createHeightmap(128, 64);
  applyGlobeStamp(grid, [1, 0, 0], { kind: "krater", radius: 0.3, strength: 0.1 });
  const center = sampleHeightmap(grid, [1, 0, 0]);
  assert.ok(center < -0.02, `center sinks (got ${center})`);
  // rim ring: sample a point ~0.24 rad off-center
  const rim = sampleHeightmap(grid, [Math.cos(0.24), Math.sin(0.24), 0]);
  assert.ok(rim > center + 0.02, "rim rises above the crater floor");
});

test("mountain stamp raises the center (globe) — deterministic", () => {
  const a = createHeightmap(128, 64);
  const b = createHeightmap(128, 64);
  applyGlobeStamp(a, [0, 0, 1], { kind: "gebirge", radius: 0.3, strength: 0.1 });
  applyGlobeStamp(b, [0, 0, 1], { kind: "gebirge", radius: 0.3, strength: 0.1 });
  assert.ok(sampleHeightmap(a, [0, 0, 1]) > 0.05, "peak raised");
  assert.deepEqual(Array.from(a.data.slice(0, 512)), Array.from(b.data.slice(0, 512)), "same input → same stamp");
});

test("planar stamps stay local to the click", () => {
  const grid = createHeightmap(128, 128);
  applyPlanarStamp(grid, 2, [0.5, 0.5], { kind: "duenen", radius: 0.35, strength: 0.08 });
  let touched = 0;
  for (const value of grid.data) if (value !== 0) touched++;
  assert.ok(touched > 0, "stamp modifies the grid");
  assert.ok(touched < grid.data.length * 0.5, "far side of the map untouched");
});

test("every stamp kind has a stroke plan", () => {
  for (const stamp of TERRAIN_STAMPS) {
    const grid = createHeightmap(64, 32);
    applyGlobeStamp(grid, [0, 1, 0], { kind: stamp.key, radius: 0.3, strength: 0.05 });
    assert.ok(grid.data.some((v) => v !== 0), `${stamp.key} modifies terrain`);
  }
});
