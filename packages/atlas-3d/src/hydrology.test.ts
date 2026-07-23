import assert from "node:assert/strict";
import { test } from "node:test";
import { carveRiverChannel, traceRiver } from "./hydrology";
import { createHeightmap } from "./planet-field";
import { samplePlanarHeightmap } from "./terrain-field";

test("river flows downhill on a slope and stops below the water level", () => {
  const path = traceRiver({
    heightAt: (x) => x * 0.1,
    start: [1, 0],
    mapSize: 2,
    waterLevel: 0,
  });
  assert.ok(path.length > 1, "path advances beyond the start");
  const first = path[0];
  const last = path[path.length - 1];
  assert.ok(last.x < first.x, `flows in -x direction (from ${first.x} to ${last.x})`);
  for (let i = 1; i < path.length; i++) {
    assert.ok(path[i].x <= path[i - 1].x + 1e-9, "x never increases on a pure -x slope");
  }
  assert.ok(last.x * 0.1 < 0.02, "ends near/below the water level");
  assert.ok(path.length < 200, "water-level cutoff ends the trace before maxSteps");
});

test("traceRiver is deterministic (including local-minimum jitter)", () => {
  // Bowl with the start at the bottom — forces the jitter path.
  const bowl = (x: number, z: number) => x * x + z * z;
  const a = traceRiver({ heightAt: bowl, start: [0, 0], mapSize: 2, waterLevel: -1 });
  const b = traceRiver({ heightAt: bowl, start: [0, 0], mapSize: 2, waterLevel: -1 });
  assert.deepEqual(a, b, "same options → same path");
  const slopeA = traceRiver({ heightAt: (x) => x * 0.1, start: [1, 0.3], mapSize: 2 });
  const slopeB = traceRiver({ heightAt: (x) => x * 0.1, start: [1, 0.3], mapSize: 2 });
  assert.deepEqual(slopeA, slopeB, "same slope options → same path");
});

test("traceRiver ends at the map edge", () => {
  const path = traceRiver({
    heightAt: (x) => x * 0.1,
    start: [-1.9, 0],
    mapSize: 2,
    waterLevel: -10,
  });
  const last = path[path.length - 1];
  assert.ok(Math.abs(last.x) <= 2 && Math.abs(last.z) <= 2, "no out-of-bounds points in the path");
  assert.ok(path.length < 200, "edge cutoff ends the trace");
});

test("carveRiverChannel lowers the heightmap along the path", () => {
  const grid = createHeightmap(128, 128);
  const mapSize = 2;
  const path = [
    { x: -0.5, z: 0 },
    { x: 0, z: 0 },
    { x: 0.5, z: 0 },
  ];
  carveRiverChannel(grid, mapSize, path, 0.03, 0.1);
  for (const point of path) {
    const u = (point.x / mapSize + 1) / 2;
    const v = (point.z / mapSize + 1) / 2;
    assert.ok(samplePlanarHeightmap(grid, u, v) < -0.01, `carved below zero at x=${point.x}`);
  }
  // A far corner stays untouched.
  assert.equal(samplePlanarHeightmap(grid, 0.05, 0.05), 0, "far cells unchanged");
});
