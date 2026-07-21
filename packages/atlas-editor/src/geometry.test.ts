import assert from "node:assert/strict";
import { test } from "node:test";
import { distanceToPolygon, parsePolygon, pointInPolygon, projectSpherePatch, type Vec2 } from "./geometry";

const square: Vec2[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

test("projectSpherePatch rejects degenerate input", () => {
  assert.equal(projectSpherePatch([[1, 0, 0], [0, 1, 0]]), null);
  assert.equal(projectSpherePatch([[1, 0, 0], [-1, 0, 0], [1, 0, 0], [-1, 0, 0]]), null);
});

test("patch at the equator projects around its centroid with arc-length radii", () => {
  const spread = 0.2; // radians
  const dirs: [number, number, number][] = [
    [Math.cos(spread), 0, Math.sin(spread)],
    [Math.cos(spread), Math.sin(spread), 0],
    [Math.cos(spread), 0, -Math.sin(spread)],
    [Math.cos(spread), -Math.sin(spread), 0],
  ];
  const patch = projectSpherePatch(dirs);
  assert.ok(patch);
  // centroid points along +x
  assert.ok(patch.centroid[0] > 0.99);
  // all four corners are ~`spread` radians from the centroid
  for (const [x, z] of patch.polygon) {
    assert.ok(Math.abs(Math.hypot(x, z) - spread) < 0.01, `corner at arc ${Math.hypot(x, z)}`);
  }
  assert.ok(Math.abs(patch.radius - spread) < 0.01);
  // opposite corners land on opposite sides of the projection
  const [a, , c] = patch.polygon;
  assert.ok(Math.sign(a[1]) !== Math.sign(c[1]) || Math.sign(a[0]) !== Math.sign(c[0]));
});

test("projection is deterministic and keeps vertex order", () => {
  const dirs: [number, number, number][] = [
    [0.9, 0.3, 0.1],
    [0.9, -0.2, 0.3],
    [0.85, 0.1, -0.35],
  ];
  const a = projectSpherePatch(dirs);
  const b = projectSpherePatch(dirs);
  assert.deepEqual(a, b);
  assert.equal(a?.polygon.length, 3);
});

test("polar patch projects without singularities", () => {
  const dirs: [number, number, number][] = [
    [0.15, 0.98, 0],
    [0, 0.98, 0.15],
    [-0.15, 0.98, 0],
    [0, 0.98, -0.15],
  ];
  const patch = projectSpherePatch(dirs);
  assert.ok(patch);
  assert.ok(patch.centroid[1] > 0.99);
  assert.ok(patch.polygon.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z)));
  assert.ok(patch.radius > 0.1 && patch.radius < 0.3);
});

test("pointInPolygon handles inside, outside and concave shapes", () => {
  assert.equal(pointInPolygon([0, 0], square), true);
  assert.equal(pointInPolygon([2, 0], square), false);
  const concave: Vec2[] = [
    [0, 0],
    [4, 0],
    [4, 4],
    [2, 1],
    [0, 4],
  ];
  assert.equal(pointInPolygon([2, 0.5], concave), true);
  assert.equal(pointInPolygon([2, 3], concave), false, "notch of the concave polygon is outside");
});

test("distanceToPolygon is negative inside and measures to the boundary", () => {
  assert.ok(Math.abs(distanceToPolygon([0, 0], square) + 1) < 1e-9);
  assert.ok(Math.abs(distanceToPolygon([2, 0], square) - 1) < 1e-9);
});

test("parsePolygon accepts {points} wrappers and rejects junk", () => {
  assert.deepEqual(parsePolygon({ points: [[0, 0], [1, 0], [0, 1]] }), [
    [0, 0],
    [1, 0],
    [0, 1],
  ]);
  assert.equal(parsePolygon({ points: [[0, 0], [1, 0]] }), null);
  assert.equal(parsePolygon({ points: [[0, 0], [1, "x"], [0, 1]] }), null);
  assert.equal(parsePolygon("nope"), null);
});
