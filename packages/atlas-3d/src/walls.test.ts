import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWallSegment, lineRoadWithTrees, type WallPoint } from "./walls";

test("tower count grows with wall length", () => {
  const short = buildWallSegment({ from: { x: 0, z: 0 }, to: { x: 0.4, z: 0 }, seed: 1, idPrefix: "w" });
  const long = buildWallSegment({ from: { x: 0, z: 0 }, to: { x: 2, z: 0 }, seed: 1, idPrefix: "w" });
  assert.ok(long.objects.length > short.objects.length, `${long.objects.length} > ${short.objects.length}`);
  assert.ok(short.objects.length >= 2, "at least both endpoints get towers");
  assert.ok(long.objects.every((o) => o.assetKind === "tower" && o.tint === "paper"));
});

test("gate splits the palisade into 2 features with a gap >= 0.1", () => {
  const wall = buildWallSegment({ from: { x: 0, z: 0 }, to: { x: 1, z: 0 }, seed: 3, idPrefix: "g" });
  assert.equal(wall.features.length, 2, "length > 0.5 defaults to a gate");
  const endOfFirst = wall.features[0].points[wall.features[0].points.length - 1];
  const startOfSecond = wall.features[1].points[0];
  const gap = Math.hypot(startOfSecond.x - endOfFirst.x, startOfSecond.z - endOfFirst.z);
  assert.ok(gap >= 0.1, `gap ${gap} >= 0.1`);
  assert.ok(wall.features.every((f) => f.kind === "road"));

  const noGate = buildWallSegment({ from: { x: 0, z: 0 }, to: { x: 1, z: 0 }, seed: 3, idPrefix: "n", gate: false });
  assert.equal(noGate.features.length, 1, "gate: false keeps one feature");
  const shortWall = buildWallSegment({ from: { x: 0, z: 0 }, to: { x: 0.3, z: 0 }, seed: 3, idPrefix: "s" });
  assert.equal(shortWall.features.length, 1, "short walls have no gate by default");
});

test("wall building is deterministic and jitter stays tiny", () => {
  const a = buildWallSegment({ from: { x: 0, z: 0 }, to: { x: 0, z: 1.4 }, seed: 8, idPrefix: "d" });
  const b = buildWallSegment({ from: { x: 0, z: 0 }, to: { x: 0, z: 1.4 }, seed: 8, idPrefix: "d" });
  assert.deepEqual(a, b);
  for (const tower of a.objects) {
    assert.ok(Math.abs(tower.position.x) <= 0.015 + 1e-9, "perpendicular jitter within ±0.015");
  }
  const ids = new Set(a.objects.map((o) => o.localId));
  assert.equal(ids.size, a.objects.length, "unique localIds");
});

test("road trees hug the path at ~offset distance on both sides", () => {
  const points: readonly WallPoint[] = [
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: 2, z: 0.4 },
  ];
  const trees = lineRoadWithTrees({ points, seed: 5 });
  assert.ok(trees.length >= 8, "a path of ~2.1 units gets plenty of trees");
  assert.deepEqual(trees, lineRoadWithTrees({ points, seed: 5 }), "deterministic");

  const distanceToSegment = (t: { x: number; z: number }, a: WallPoint, b: WallPoint) => {
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const len2 = ex * ex + ez * ez;
    const s = len2 > 0 ? Math.min(1, Math.max(0, ((t.x - a.x) * ex + (t.z - a.z) * ez) / len2)) : 0;
    return Math.hypot(t.x - (a.x + ex * s), t.z - (a.z + ez * s));
  };
  for (const tree of trees) {
    let nearest = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
      nearest = Math.min(nearest, distanceToSegment(tree, points[i], points[i + 1]));
    }
    assert.ok(Math.abs(nearest - 0.07) <= 0.03, `tree at ~offset from the path (got ${nearest})`);
  }
});
