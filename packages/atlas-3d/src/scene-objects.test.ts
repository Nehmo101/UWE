import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDocFeatures } from "./scene-objects";

test("parseDocFeatures accepts the new kinds with their point minimums", () => {
  const features = parseDocFeatures([
    { localId: "t1", kind: "territory", points: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }] },
    { localId: "t2", kind: "territory", points: [{ x: 0, z: 0 }, { x: 1, z: 0 }] }, // < 3 → dropped
    { localId: "p1", kind: "poi", points: [{ x: 0.5, z: 0.5 }], labelText: "Höhle" },
    { localId: "l1", kind: "lake", points: [{ x: 0, z: 0 }] },
    { localId: "x1", kind: "vulkan", points: [{ x: 0, z: 0 }] }, // unknown kind → dropped
  ]);
  assert.deepEqual(
    features.map((f) => f.localId),
    ["t1", "p1", "l1"],
  );
  assert.equal(features[1].labelText, "Höhle");
});

test("parseDocFeatures round-trips tint and level", () => {
  const input = [
    { localId: "t1", kind: "territory", points: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }], tint: "gefahr" },
    { localId: "l1", kind: "lake", points: [{ x: 0, z: 0 }, { x: 0.3, z: 0 }], level: 0.12 },
  ];
  const first = parseDocFeatures(input);
  assert.equal(first[0].tint, "gefahr");
  assert.equal(first[1].level, 0.12);
  const second = parseDocFeatures(JSON.parse(JSON.stringify(first)));
  assert.deepEqual(second, first);
});

test("parseDocFeatures drops invalid tint/level values", () => {
  const features = parseDocFeatures([
    { localId: "t1", kind: "territory", points: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }], tint: 7 },
    { localId: "l1", kind: "lake", points: [{ x: 0, z: 0 }], level: Number.NaN },
  ]);
  assert.equal(features[0].tint, undefined);
  assert.equal(features[1].level, undefined);
});

test("parseDocFeatures keeps river/road/label behavior", () => {
  const features = parseDocFeatures([
    { localId: "r1", kind: "river", points: [{ x: 0, z: 0 }, { x: 1, z: 1 }] },
    { localId: "r2", kind: "river", points: [{ x: 0, z: 0 }] }, // < 2 → dropped
    { localId: "la", kind: "label", points: [{ x: 0, z: 0 }], labelText: "Hafenstadt" },
  ]);
  assert.deepEqual(
    features.map((f) => f.localId),
    ["r1", "la"],
  );
});
