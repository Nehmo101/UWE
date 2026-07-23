import assert from "node:assert/strict";
import { test } from "node:test";
import { scatterInstances } from "./scatter";

test("scatter is deterministic per click + seed and varies per instance", () => {
  const a = scatterInstances({ mode: "terrain", center: [0.3, 0, -0.2], radius: 0.3, seed: 5 });
  const b = scatterInstances({ mode: "terrain", center: [0.3, 0, -0.2], radius: 0.3, seed: 5 });
  assert.deepEqual(a, b, "same click → same cluster");
  const c = scatterInstances({ mode: "terrain", center: [0.3, 0, -0.2], radius: 0.3, seed: 6 });
  assert.notDeepEqual(a, c, "different seed → different cluster");
  const scales = new Set(a.map((i) => i.scale.toFixed(4)));
  assert.ok(scales.size > 1, "scales vary");
});

test("terrain instances stay within the cluster radius", () => {
  const cluster = scatterInstances({ mode: "terrain", center: [1, 0, 1], radius: 0.25, seed: 9 });
  for (const instance of cluster) {
    const dist = Math.hypot(instance.position[0] - 1, instance.position[2] - 1);
    assert.ok(dist <= 0.2501, `instance within radius (got ${dist})`);
  }
});

test("globe instances are unit directions near the click", () => {
  const cluster = scatterInstances({ mode: "globe", center: [0, 1, 0], radius: 0.2, seed: 3, count: 8 });
  assert.equal(cluster.length, 8);
  for (const instance of cluster) {
    const len = Math.hypot(...instance.position);
    assert.ok(Math.abs(len - 1) < 1e-9, "unit direction");
    assert.ok(instance.position[1] > 0.95, "stays near the pole click");
  }
});
