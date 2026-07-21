import assert from "node:assert/strict";
import { test } from "node:test";
import { surfaceNets } from "./surface-nets";

const sphere = (r: number) => (x: number, y: number, z: number) => Math.hypot(x, y, z) - r;

test("meshes a sphere with vertices on the surface", () => {
  const result = surfaceNets(sphere(1), [-1.5, -1.5, -1.5], [1.5, 1.5, 1.5], [24, 24, 24]);
  assert.ok(result.positions.length > 0, "produces vertices");
  assert.equal(result.indices.length % 3, 0, "triangles come in threes");
  const cell = 3 / 24;
  for (let v = 0; v < result.positions.length; v += 3) {
    const r = Math.hypot(result.positions[v], result.positions[v + 1], result.positions[v + 2]);
    assert.ok(Math.abs(r - 1) < cell, `vertex radius ${r} within one cell of the surface`);
  }
});

test("all indices are valid and triangles are non-degenerate", () => {
  const result = surfaceNets(sphere(1), [-1.5, -1.5, -1.5], [1.5, 1.5, 1.5], [16, 16, 16]);
  const vertexCount = result.positions.length / 3;
  for (const index of result.indices) {
    assert.ok(index >= 0 && index < vertexCount, "index in range");
  }
  for (let t = 0; t < result.indices.length; t += 3) {
    const [a, b, c] = [result.indices[t], result.indices[t + 1], result.indices[t + 2]];
    assert.ok(a !== b && b !== c && a !== c, "no degenerate triangle");
  }
});

test("triangles wind outward for a sphere (normals point away from center)", () => {
  const result = surfaceNets(sphere(1), [-1.5, -1.5, -1.5], [1.5, 1.5, 1.5], [20, 20, 20]);
  let outward = 0;
  let total = 0;
  for (let t = 0; t < result.indices.length; t += 3) {
    const read = (index: number): [number, number, number] => [
      result.positions[index * 3],
      result.positions[index * 3 + 1],
      result.positions[index * 3 + 2],
    ];
    const a = read(result.indices[t]);
    const b = read(result.indices[t + 1]);
    const c = read(result.indices[t + 2]);
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const centroid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (n[0] * centroid[0] + n[1] * centroid[1] + n[2] * centroid[2] > 0) outward++;
    total++;
  }
  assert.ok(outward / total > 0.95, `${outward}/${total} triangles wind outward`);
});

test("deterministic: identical inputs produce identical buffers", () => {
  const a = surfaceNets(sphere(0.8), [-1, -1, -1], [1, 1, 1], [14, 14, 14]);
  const b = surfaceNets(sphere(0.8), [-1, -1, -1], [1, 1, 1], [14, 14, 14]);
  assert.deepEqual(Array.from(a.positions), Array.from(b.positions));
  assert.deepEqual(Array.from(a.indices), Array.from(b.indices));
});

test("empty field produces an empty mesh", () => {
  const result = surfaceNets(() => 1, [-1, -1, -1], [1, 1, 1], [8, 8, 8]);
  assert.equal(result.positions.length, 0);
  assert.equal(result.indices.length, 0);
});
