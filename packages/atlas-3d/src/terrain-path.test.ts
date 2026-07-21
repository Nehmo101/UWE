import assert from "node:assert/strict";
import { test } from "node:test";
import { createHeightmap } from "./planet-field";
import { applyPlanarBrush, createTerrainField } from "./terrain-field";
import { findTerrainPath, simplifyPath } from "./terrain-path";

test("finds a deterministic route between two points", () => {
  const field = createTerrainField({ seed: 6 });
  const a = findTerrainPath(field, { x: -1.2, z: -1.0 }, { x: 1.2, z: 1.0 }, { kind: "road" });
  const b = findTerrainPath(field, { x: -1.2, z: -1.0 }, { x: 1.2, z: 1.0 }, { kind: "road" });
  assert.ok(a && a.length >= 2);
  assert.deepEqual(a, b);
  assert.deepEqual(a[0], { x: -1.2, z: -1.0 });
  assert.deepEqual(a[a.length - 1], { x: 1.2, z: 1.0 });
});

test("roads route around a steep sculpted ridge instead of over it", () => {
  const grid = createHeightmap(96, 96);
  // vertical wall across the middle with a low pass at the south edge
  for (let z = -1.6; z <= 1.0; z += 0.05) {
    applyPlanarBrush(grid, 2, [0, z], 0.3, 0.5, "raise");
  }
  const field = createTerrainField({ seed: 1, heightmap: grid });
  const path = findTerrainPath(field, { x: -1.2, z: 0 }, { x: 1.2, z: 0 }, { kind: "road", resolution: 64 });
  assert.ok(path);
  // the route must dip toward the pass instead of climbing straight over x=0
  const crossing = path.find((p) => Math.abs(p.x) < 0.15);
  assert.ok(crossing, "path crosses the ridge line somewhere");
  assert.ok(crossing.z > 1.0, `crossing detours through the southern pass (z=${crossing.z.toFixed(2)})`);
});

test("rivers strongly prefer downhill routing", () => {
  const grid = createHeightmap(96, 96);
  applyPlanarBrush(grid, 2, [-1.0, 0], 0.6, 0.5, "raise");
  const field = createTerrainField({ seed: 2, heightmap: grid });
  const downhill = findTerrainPath(field, { x: -1.0, z: 0 }, { x: 1.4, z: 0 }, { kind: "river", resolution: 64 });
  assert.ok(downhill, "downhill river routes fine");
  const heights = downhill.map((p) => field.height(p.x, p.z));
  let bigClimbs = 0;
  for (let i = 1; i < heights.length; i++) {
    if (heights[i] - heights[i - 1] > 0.08) bigClimbs++;
  }
  assert.ok(bigClimbs <= 1, `river avoids climbing (${bigClimbs} climbs)`);
});

test("routing refuses endpoints outside the silhouette", () => {
  const field = createTerrainField({
    seed: 3,
    silhouette: [
      [-1, -1],
      [1, -1],
      [0, 1],
    ],
  });
  assert.equal(findTerrainPath(field, { x: -1.9, z: 1.9 }, { x: 0, z: 0 }, { kind: "road" }), null);
});

test("simplifyPath keeps endpoints and drops collinear points", () => {
  const straight = [
    { x: 0, z: 0 },
    { x: 0.5, z: 0.001 },
    { x: 1, z: 0 },
    { x: 1.5, z: -0.001 },
    { x: 2, z: 0 },
  ];
  const simplified = simplifyPath(straight, 0.05);
  assert.equal(simplified.length, 2);
  assert.deepEqual(simplified[0], { x: 0, z: 0 });
  assert.deepEqual(simplified[1], { x: 2, z: 0 });
});
