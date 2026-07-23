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

test("walls constraint adds a tower ring and a palisade line with a gate", () => {
  const plain = generateSettlement3D(base);
  const walled = generateSettlement3D({ ...base, walls: true });
  const plainTowers = plain.objects.filter((o) => o.assetKind === "tower").length;
  const walledTowers = walled.objects.filter((o) => o.assetKind === "tower").length;
  assert.equal(walledTowers, plainTowers + 6, "six wall towers");
  const palisade = walled.features.find((f) => f.localId.endsWith("-mauer"));
  assert.ok(palisade, "palisade feature exists");
  assert.equal(palisade?.kind, "road");
  const points = palisade?.points ?? [];
  const first = points[0];
  const last = points[points.length - 1];
  assert.ok(Math.hypot(first.x - last.x, first.z - last.z) > 0.05, "gate stays open (loop not closed)");
});

test("citadel constraint adds one dominant tower on the plaza", () => {
  const plain = generateSettlement3D(base);
  const withCitadel = generateSettlement3D({ ...base, citadel: true });
  assert.equal(withCitadel.objects.length, plain.objects.length + 1);
  const big = withCitadel.objects.find((o) => o.assetKind === "tower" && o.scale === 1.5);
  assert.ok(big, "citadel tower present");
  const pos = big?.position as { x: number; z: number };
  assert.ok(Math.hypot(pos.x - base.center.x, pos.z - base.center.z) < 0.1, "near the plaza");
});
