import assert from "node:assert/strict";
import { test } from "node:test";
import { distanceToPolygon, parsePolygon, pointInPolygon, projectSpherePatch, projectSurfacePatch, type Vec2 } from "./geometry";

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

// --- projectSurfacePatch (interior surfaces) ---

test("projectSurfacePatch: crater floor at radius 0.6 keeps relative distances", () => {
  const points: [number, number, number][] = [
    [0.6, -0.1, -0.1],
    [0.6, 0.1, -0.1],
    [0.6, 0.1, 0.1],
    [0.6, -0.1, 0.1],
  ];
  const patch = projectSurfacePatch(points, [1, 0, 0]);
  assert.ok(patch);
  assert.ok(Math.abs(Math.abs(patch.normal[0]) - 1) < 1e-6, "plane normal is ±x");
  assert.ok(Math.abs(patch.radius - Math.hypot(0.1, 0.1)) < 1e-6, "radius stays in world units");
  // pairwise 2D distances equal the 3D input distances (planar patch → exact)
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const d3 = Math.hypot(points[i][1] - points[j][1], points[i][2] - points[j][2]);
    const d2 = Math.hypot(patch.polygon[i][0] - patch.polygon[j][0], patch.polygon[i][1] - patch.polygon[j][1]);
    assert.ok(Math.abs(d3 - d2) < 1e-6);
  }
});

test("projectSurfacePatch: vertical cut face with mixed radii does not degenerate", () => {
  // Points in the x=0 split plane, one deep inside the hull — the old
  // sphere projection could cancel out on exactly this kind of input.
  const points: [number, number, number][] = [
    [0, 0.8, 0.2],
    [0, 0.3, -0.4],
    [0, -0.5, 0.1],
    [0, 0.2, 0.55],
  ];
  const patch = projectSurfacePatch(points, [1, 0, 0]);
  assert.ok(patch, "cut-face patch projects");
  assert.ok(Math.abs(patch.normal[0]) > 0.999, "normal follows the hint side");
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d3 = Math.hypot(points[i][1] - points[j][1], points[i][2] - points[j][2]);
      const d2 = Math.hypot(patch.polygon[i][0] - patch.polygon[j][0], patch.polygon[i][1] - patch.polygon[j][1]);
      assert.ok(Math.abs(d3 - d2) < 1e-6, `distance ${i}-${j} preserved`);
    }
  }
});

test("projectSurfacePatch: colinear or coincident points → null", () => {
  assert.equal(projectSurfacePatch([[0, 0, 0], [0.5, 0, 0]]), null, "too few");
  assert.equal(
    projectSurfacePatch([
      [0.2, 0.2, 0.2],
      [0.4, 0.4, 0.4],
      [0.6, 0.6, 0.6],
    ]),
    null,
    "colinear",
  );
  assert.equal(
    projectSurfacePatch([
      [0.3, 0.1, 0],
      [0.3, 0.1, 0],
      [0.3, 0.1, 0],
    ]),
    null,
    "coincident",
  );
});

test("projectSurfacePatch: hull patch matches projectSpherePatch shape within 5%", () => {
  const spread = 0.2;
  const dirs: [number, number, number][] = [
    [Math.cos(spread), 0, Math.sin(spread)],
    [Math.cos(spread), Math.sin(spread), 0],
    [Math.cos(spread), 0, -Math.sin(spread)],
    [Math.cos(spread), -Math.sin(spread), 0],
  ];
  const sphere = projectSpherePatch(dirs);
  const surface = projectSurfacePatch(dirs);
  assert.ok(sphere && surface);
  for (let i = 0; i < dirs.length; i++) {
    const [sx, sz] = sphere.polygon[i];
    const [fx, fz] = surface.polygon[i];
    // normalize both by their radius — only relative shape matters downstream
    assert.ok(Math.abs(sx / sphere.radius - fx / surface.radius) < 0.05, `x[${i}]`);
    assert.ok(Math.abs(sz / sphere.radius - fz / surface.radius) < 0.05, `z[${i}]`);
  }
});

test("projectSurfacePatch: normal hint controls orientation (no mirroring)", () => {
  const points: [number, number, number][] = [
    [0, 0.4, 0],
    [0, 0, 0.4],
    [0, -0.4, 0],
    [0, 0, -0.4],
  ];
  const plus = projectSurfacePatch(points, [1, 0, 0]);
  const minus = projectSurfacePatch(points, [-1, 0, 0]);
  assert.ok(plus && minus);
  assert.ok(plus.normal[0] > 0.999 && minus.normal[0] < -0.999);
  // flipping the hint mirrors the in-plane x axis (east = up × normal)
  for (let i = 0; i < points.length; i++) {
    assert.ok(Math.abs(plus.polygon[i][0] + minus.polygon[i][0]) < 1e-6, `x[${i}] mirrored`);
    assert.ok(Math.abs(plus.polygon[i][1] - minus.polygon[i][1]) < 1e-6, `z[${i}] stable`);
  }
});
