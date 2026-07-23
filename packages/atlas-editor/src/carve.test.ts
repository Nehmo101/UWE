import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCarveOps,
  carveOpDistance,
  dominantCarveOp,
  parseCarveOps,
  serializeCarveOps,
  type CarveOp,
} from "./carve";

const bite: CarveOp = { id: "b1", kind: "bite", center: [1, 0, 0], radius: 0.5 };
const split: CarveOp = { id: "s1", kind: "split", normal: [1, 0, 0], gap: 0.4 };
const tunnel: CarveOp = { id: "t1", kind: "tunnel", from: [-1, 0, 0], to: [1, 0, 0], radius: 0.2 };

test("parseCarveOps drops invalid entries and keeps order", () => {
  const parsed = parseCarveOps([
    { id: "b1", kind: "bite", center: [1, 0, 0], radius: 0.5 },
    { id: "bad", kind: "bite", center: [1, 0], radius: 0.5 },
    { id: "bad2", kind: "laser", center: [0, 0, 0], radius: 1 },
    { id: "s1", kind: "split", normal: [1, 0, 0], gap: 0.4, paint: [{ hue: "blue", center: [0.3, 0.2], radius: 0.25 }] },
  ]);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].id, "b1");
  assert.equal(parsed[1].kind, "split");
  assert.equal(parsed[1].paint?.[0].hue, "blue");
});

test("serialization is stable and round-trips through parse", () => {
  const ops = [bite, split, tunnel];
  const json = serializeCarveOps(ops);
  assert.equal(json, serializeCarveOps(parseCarveOps(JSON.parse(json))));
});

test("split roots round-trip, clamp to range and drop invalid values", () => {
  const withRoots = parseCarveOps([{ id: "s1", kind: "split", normal: [1, 0, 0], gap: 0.4, roots: 9 }]);
  assert.equal(withRoots[0].kind === "split" && withRoots[0].roots, 9);
  const json = serializeCarveOps(withRoots);
  assert.equal(json, serializeCarveOps(parseCarveOps(JSON.parse(json))));

  const clamped = parseCarveOps([
    { id: "lo", kind: "split", normal: [1, 0, 0], gap: 0.4, roots: 0 },
    { id: "hi", kind: "split", normal: [1, 0, 0], gap: 0.4, roots: 99 },
    { id: "bad", kind: "split", normal: [1, 0, 0], gap: 0.4, roots: "viele" },
  ]);
  assert.equal(clamped[0].kind === "split" && clamped[0].roots, 1);
  assert.equal(clamped[1].kind === "split" && clamped[1].roots, 24);
  assert.equal(clamped[2].kind === "split" && clamped[2].roots, undefined);
});

test("bite removes a spherical region (CSG subtraction)", () => {
  const base = -1; // deep inside the planet
  const inside = applyCarveOps(base, [1, 0, 0], [bite]);
  assert.ok(inside > 0, "point at bite center must be carved away");
  const untouched = applyCarveOps(base, [-1, 0, 0], [bite]);
  assert.equal(untouched, base);
});

test("split removes a slab around the plane and leaves the halves", () => {
  assert.ok(applyCarveOps(-1, [0, 0.3, 0.9], [split]) > 0, "point on the split plane is removed");
  assert.ok(applyCarveOps(-1, [0.19, 0, 0], [split]) > 0, "inside half-gap is removed");
  // Outside the gap the material remains (negative), but the distance now
  // measures to the new cut face — 0.3 away for x=0.5 with gap 0.4.
  assert.equal(applyCarveOps(-1, [0.5, 0, 0], [split]), -0.3, "outside the gap stays solid");
  assert.equal(applyCarveOps(-1, [2, 0, 0], [split]), -1, "far from the cut the base wins");
});

test("tunnel carves along the capsule", () => {
  assert.ok(applyCarveOps(-1, [0, 0, 0], [tunnel]) > 0);
  assert.ok(applyCarveOps(-1, [0.9, 0, 0], [tunnel]) > 0);
  assert.ok(applyCarveOps(-1, [0, 0.5, 0], [tunnel]) < 0, "beside the tunnel stays solid");
  assert.equal(applyCarveOps(-1, [0, 3, 0], [tunnel]), -1, "far away the base wins");
});

test("wedge removes the angular sector at any radius", () => {
  const wedge: CarveOp = { id: "w1", kind: "wedge", angleStart: -0.3, angleEnd: 0.3 };
  assert.ok(carveOpDistance(wedge, [1, 0, 0]) < 0, "inside sector");
  assert.ok(carveOpDistance(wedge, [2, 0, 0.1]) < 0, "inside sector further out");
  assert.ok(carveOpDistance(wedge, [-1, 0, 0]) > 0, "opposite side untouched");
});

test("determinism: same ops, same field values", () => {
  const ops = parseCarveOps(JSON.parse(serializeCarveOps([bite, tunnel, split])));
  const samples: [number, number, number][] = [
    [0, 0, 0],
    [0.3, 0.2, -0.4],
    [1, 0, 0],
    [-0.7, 0.5, 0.1],
  ];
  for (const p of samples) {
    assert.equal(applyCarveOps(-0.8, p, ops), applyCarveOps(-0.8, p, [bite, tunnel, split]));
  }
});

test("dominantCarveOp picks the deepest containing op for cut-face materials", () => {
  assert.equal(dominantCarveOp([1, 0, 0], [split, bite]), 1);
  assert.equal(dominantCarveOp([0, 0, 0.5], [split, bite]), 0);
  assert.equal(dominantCarveOp([5, 5, 5], [split, bite]), -1);
});
