import assert from "node:assert/strict";
import { test } from "node:test";
import { cloneHeightmap, createHeightmap, sampleHeightmap } from "./planet-field";
import { applyGlobeStamp, applyPlanarStamp, mutateRegionGlobe, mutateRegionPlanar, TERRAIN_STAMPS } from "./stamps";

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

test("planar region mutation changes only the brush circle", () => {
  const grid = createHeightmap(128, 128);
  grid.data.fill(0.2);
  const before = cloneHeightmap(grid);
  const mapSize = 2;
  const center: readonly [number, number] = [0.4, -0.3];
  const radius = 0.5;
  mutateRegionPlanar(grid, mapSize, center, radius, 11);
  const texRadius = (radius / (mapSize * 2)) * grid.width;
  const cx = ((center[0] / mapSize + 1) / 2) * (grid.width - 1);
  const cy = ((center[1] / mapSize + 1) / 2) * (grid.height - 1);
  let changed = 0;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const index = y * grid.width + x;
      if (grid.data[index] === before.data[index]) continue;
      changed++;
      assert.ok(Math.hypot(x - cx, y - cy) <= texRadius, `changed texel (${x},${y}) inside the brush`);
    }
  }
  assert.ok(changed > 0, "mutation changes the region");
});

test("region mutation: same seed identical, different seeds differ (planar + globe)", () => {
  const planarA = createHeightmap(96, 96);
  const planarB = createHeightmap(96, 96);
  const planarC = createHeightmap(96, 96);
  mutateRegionPlanar(planarA, 2, [0, 0], 0.6, 7);
  mutateRegionPlanar(planarB, 2, [0, 0], 0.6, 7);
  mutateRegionPlanar(planarC, 2, [0, 0], 0.6, 8);
  assert.deepEqual(Array.from(planarA.data), Array.from(planarB.data), "planar: same seed → identical");
  assert.notDeepEqual(Array.from(planarA.data), Array.from(planarC.data), "planar: different seed → different");

  const globeA = createHeightmap(128, 64);
  const globeB = createHeightmap(128, 64);
  const globeC = createHeightmap(128, 64);
  mutateRegionGlobe(globeA, [0, 0, 1], 0.4, 7);
  mutateRegionGlobe(globeB, [0, 0, 1], 0.4, 7);
  mutateRegionGlobe(globeC, [0, 0, 1], 0.4, 9);
  assert.deepEqual(Array.from(globeA.data), Array.from(globeB.data), "globe: same seed → identical");
  assert.notDeepEqual(Array.from(globeA.data), Array.from(globeC.data), "globe: different seed → different");
});

test("globe region mutation stays local", () => {
  const grid = createHeightmap(128, 64);
  grid.data.fill(0.15);
  mutateRegionGlobe(grid, [1, 0, 0], 0.35, 3);
  assert.ok(Math.abs(sampleHeightmap(grid, [1, 0, 0]) - 0.15) > 1e-4, "center rewritten");
  assert.equal(sampleHeightmap(grid, [-1, 0, 0]), Math.fround(0.15), "antipode untouched");
});

test("every stamp kind has a stroke plan", () => {
  for (const stamp of TERRAIN_STAMPS) {
    const grid = createHeightmap(64, 32);
    applyGlobeStamp(grid, [0, 1, 0], { kind: stamp.key, radius: 0.3, strength: 0.05 });
    assert.ok(grid.data.some((v) => v !== 0), `${stamp.key} modifies terrain`);
  }
});
