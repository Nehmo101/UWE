import assert from "node:assert/strict";
import { test } from "node:test";
import { generateSettlement3D } from "./settlement3d";

const base = { center: { x: 0.4, z: -0.3 }, seed: 8231, idPrefix: "s" };

test("deterministic: same inputs produce the identical settlement", () => {
  const a = generateSettlement3D(base);
  const b = generateSettlement3D(base);
  assert.deepEqual(a, b);
});

test("different seeds shift the layout", () => {
  const a = generateSettlement3D(base);
  const b = generateSettlement3D({ ...base, seed: 999 });
  assert.notDeepEqual(a.objects.map((o) => o.position), b.objects.map((o) => o.position));
});

test("layout contains houses, one tower, one tree and a road stub", () => {
  const result = generateSettlement3D({ ...base, houseCount: 6 });
  const kinds = result.objects.map((o) => o.assetKind);
  assert.equal(kinds.filter((k) => k === "house").length, 6);
  assert.equal(kinds.filter((k) => k === "tower").length, 1);
  assert.equal(kinds.filter((k) => k === "tree").length, 1);
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].kind, "road");
  assert.ok(result.features[0].points.length >= 3);
});

test("everything stays within the footprint around the click", () => {
  const radius = 0.42;
  const result = generateSettlement3D(base);
  for (const object of result.objects) {
    const x = object.position.x as number;
    const z = object.position.z as number;
    const distance = Math.hypot(x - base.center.x, z - base.center.z);
    assert.ok(distance <= radius * 1.2 + 1e-9, `${object.assetKind} at ${distance.toFixed(2)} inside footprint`);
  }
});

test("houses face the plaza and ids are unique", () => {
  const result = generateSettlement3D(base);
  const ids = new Set(result.objects.map((o) => o.localId));
  assert.equal(ids.size, result.objects.length);
  for (const house of result.objects.filter((o) => o.assetKind === "house")) {
    const x = house.position.x as number;
    const z = house.position.z as number;
    const toPlaza = Math.atan2(base.center.x - x, base.center.z - z);
    assert.ok(Math.abs(house.rotation - toPlaza) < 1e-9);
  }
});
