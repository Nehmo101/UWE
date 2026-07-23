import assert from "node:assert/strict";
import { test } from "node:test";
import { pointInPolygon } from "@uwe/atlas-editor/geometry";
import { AREA_FILL_KINDS, fillArea, type AreaFillKindKey } from "./area-fill";

const SQUARE: readonly [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

const L_SHAPE: readonly [number, number][] = [
  [0, 0],
  [1.2, 0],
  [1.2, 0.5],
  [0.5, 0.5],
  [0.5, 1.2],
  [0, 1.2],
];

test("all instances lie inside the polygon", () => {
  for (const kind of AREA_FILL_KINDS.map((k) => k.key) as readonly AreaFillKindKey[]) {
    for (const polygon of [SQUARE, L_SHAPE]) {
      const instances = fillArea({ polygon, kind, seed: 4 });
      assert.ok(instances.length > 0, `${kind} produces instances`);
      for (const instance of instances) {
        assert.ok(pointInPolygon([instance.x, instance.z], polygon), `${kind}: (${instance.x}, ${instance.z}) inside`);
      }
    }
  }
});

test("fill is deterministic", () => {
  const a = fillArea({ polygon: SQUARE, kind: "wald", seed: 9 });
  const b = fillArea({ polygon: SQUARE, kind: "wald", seed: 9 });
  assert.deepEqual(a, b);
  const c = fillArea({ polygon: SQUARE, kind: "wald", seed: 10 });
  assert.notDeepEqual(a, c, "different seed → different fill");
});

test("wald is denser than hain on the same polygon", () => {
  const wald = fillArea({ polygon: SQUARE, kind: "wald", seed: 2 });
  const hain = fillArea({ polygon: SQUARE, kind: "hain", seed: 2 });
  assert.ok(wald.length > hain.length, `wald ${wald.length} > hain ${hain.length}`);
});

test("felder form rows: far fewer distinct rounded z values than wald", () => {
  const felder = fillArea({ polygon: SQUARE, kind: "felder", seed: 2 });
  const wald = fillArea({ polygon: SQUARE, kind: "wald", seed: 2 });
  const roundedZ = (list: readonly { z: number }[]) => new Set(list.map((i) => i.z.toFixed(2))).size;
  const felderRows = roundedZ(felder);
  const waldRows = roundedZ(wald);
  assert.ok(felderRows * 2 < waldRows, `felder ${felderRows} rows vs wald ${waldRows}`);
});

test("kinds use their expected asset palette", () => {
  const wald = fillArea({ polygon: SQUARE, kind: "wald", seed: 6 });
  assert.ok(wald.every((i) => i.assetKind === "tree" || i.assetKind === "busch"));
  assert.ok(wald.some((i) => i.assetKind === "tree" && i.tint === "teal"));
  const markt = fillArea({ polygon: SQUARE, kind: "markt", seed: 6 });
  assert.ok(markt.some((i) => i.assetKind === "house" && i.tint === "terra"));
  const felder = fillArea({ polygon: SQUARE, kind: "felder", seed: 6 });
  assert.ok(felder.every((i) => i.assetKind === "busch" && i.tint === "sepia"));
});
