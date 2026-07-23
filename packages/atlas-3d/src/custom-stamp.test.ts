import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCustomStampGlobe,
  applyCustomStampPlanar,
  sampleCustomStamp,
  type CustomStampGrid,
} from "./custom-stamp";
import { createHeightmap, sampleHeightmap } from "./planet-field";
import { samplePlanarHeightmap } from "./terrain-field";

/** 2×2 diagonal stamp: white in the (0,0) and (1,1) corners. */
const diagonalStamp: CustomStampGrid = {
  width: 2,
  height: 2,
  data: new Float32Array([1, 0, 0, 1]),
};

test("bilinear stamp sampling hits corners and center", () => {
  assert.equal(sampleCustomStamp(diagonalStamp, 0, 0), 1);
  assert.equal(sampleCustomStamp(diagonalStamp, 1, 0), 0);
  assert.equal(sampleCustomStamp(diagonalStamp, 0, 1), 0);
  assert.equal(sampleCustomStamp(diagonalStamp, 1, 1), 1);
  assert.ok(Math.abs(sampleCustomStamp(diagonalStamp, 0.5, 0.5) - 0.5) < 1e-6, "center blends to 0.5");
});

test("planar custom stamp lifts the correct quadrants", () => {
  const grid = createHeightmap(128, 128);
  const mapSize = 2;
  const radius = 0.5;
  applyCustomStampPlanar(grid, mapSize, [0, 0], diagonalStamp, radius, 0.1);
  const heightAt = (x: number, z: number) =>
    samplePlanarHeightmap(grid, (x / mapSize + 1) / 2, (z / mapSize + 1) / 2);
  // White corners: stamp uv (0,0) → map (-radius,-radius); uv (1,1) → (+radius,+radius).
  assert.ok(heightAt(-0.4, -0.4) > 0.05, "(-,-) quadrant lifted");
  assert.ok(heightAt(0.4, 0.4) > 0.05, "(+,+) quadrant lifted");
  assert.ok(heightAt(0.4, -0.4) < 0.02, "(+,-) quadrant stays low");
  assert.ok(heightAt(-0.4, 0.4) < 0.02, "(-,+) quadrant stays low");
});

test("planar custom stamp leaves cells outside the square untouched", () => {
  const grid = createHeightmap(128, 128);
  applyCustomStampPlanar(grid, 2, [0, 0], diagonalStamp, 0.5, 0.1);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const mx = ((x / (grid.width - 1)) * 2 - 1) * 2;
      const mz = ((y / (grid.height - 1)) * 2 - 1) * 2;
      if (Math.abs(mx) <= 0.5 && Math.abs(mz) <= 0.5) continue;
      assert.equal(grid.data[y * grid.width + x], 0, `cell at (${mx.toFixed(2)},${mz.toFixed(2)}) untouched`);
    }
  }
});

test("planar custom stamp is deterministic", () => {
  const a = createHeightmap(96, 96);
  const b = createHeightmap(96, 96);
  applyCustomStampPlanar(a, 2, [0.3, -0.2], diagonalStamp, 0.4, 0.08);
  applyCustomStampPlanar(b, 2, [0.3, -0.2], diagonalStamp, 0.4, 0.08);
  assert.deepEqual(Array.from(a.data), Array.from(b.data));
});

test("globe custom stamp lifts around the center and leaves the far side alone", () => {
  const grid = createHeightmap(128, 64);
  const solid: CustomStampGrid = { width: 2, height: 2, data: new Float32Array([1, 1, 1, 1]) };
  applyCustomStampGlobe(grid, [1, 0, 0], solid, 0.3, 0.1);
  assert.ok(sampleHeightmap(grid, [1, 0, 0]) > 0.05, "center lifted");
  assert.equal(sampleHeightmap(grid, [-1, 0, 0]), 0, "antipode untouched");
  const b = createHeightmap(128, 64);
  applyCustomStampGlobe(b, [1, 0, 0], solid, 0.3, 0.1);
  assert.deepEqual(Array.from(grid.data), Array.from(b.data), "deterministic");
});
