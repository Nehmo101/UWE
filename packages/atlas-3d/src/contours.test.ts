import assert from "node:assert/strict";
import { test } from "node:test";
import { computeContours } from "./contours";

/** Inverted distance cone — circular contours around the origin. */
const cone = (x: number, z: number) => 1 - Math.hypot(x, z);

test("cone height field yields contour segments close to their levels", () => {
  const { segments, levels } = computeContours({ heightAt: cone, mapSize: 2, resolution: 64 });
  assert.ok(levels.length > 0, "default levels computed");
  assert.ok(segments.length > 0, "segments emitted");
  for (const [x1, z1, x2, z2] of segments) {
    const midHeight = cone((x1 + x2) / 2, (z1 + z2) / 2);
    const nearest = Math.min(...levels.map((level) => Math.abs(midHeight - level)));
    assert.ok(nearest < 0.02, `segment midpoint sits on a level (off by ${nearest})`);
  }
});

test("cone contours are approximately circular", () => {
  const level = 0.5; // cone height 0.5 → circle of radius 0.5
  const { segments } = computeContours({ heightAt: cone, mapSize: 2, resolution: 96, levels: [level] });
  assert.ok(segments.length > 8, "closed ring has many segments");
  for (const [x1, z1, x2, z2] of segments) {
    for (const [px, pz] of [
      [x1, z1],
      [x2, z2],
    ] as const) {
      assert.ok(Math.abs(Math.hypot(px, pz) - 0.5) < 0.05, `point (${px},${pz}) lies near the r=0.5 circle`);
    }
  }
});

test("computeContours is deterministic", () => {
  const a = computeContours({ heightAt: cone, mapSize: 2, resolution: 48 });
  const b = computeContours({ heightAt: cone, mapSize: 2, resolution: 48 });
  assert.deepEqual(a.levels, b.levels, "same levels");
  assert.deepEqual(a.segments, b.segments, "same segments");
});

test("explicit levels are honored and returned", () => {
  const { levels } = computeContours({ heightAt: cone, mapSize: 2, levels: [0.25, 0.75] });
  assert.deepEqual(levels, [0.25, 0.75]);
});
