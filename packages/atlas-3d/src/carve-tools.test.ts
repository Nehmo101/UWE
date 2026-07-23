import assert from "node:assert/strict";
import { test } from "node:test";
import type { CarveOp } from "@uwe/atlas-editor/carve";
import { makeBiteOp, makeTunnelOp, removeCarveOpById, summarizeCarveOps } from "./carve-tools";

const ops: CarveOp[] = [
  { id: "b1", kind: "bite", center: [1, 0, 0], radius: 0.3 },
  { id: "b2", kind: "bite", center: [0, 1, 0], radius: 0.2 },
  { id: "t1", kind: "tunnel", from: [-1, 0, 0], to: [1, 0, 0], radius: 0.1 },
  { id: "welt-spalt", kind: "split", normal: [1, 0, 0], gap: 0.3 },
];

test("summarizeCarveOps numbers ops per kind with German labels", () => {
  const summaries = summarizeCarveOps(ops);
  assert.deepEqual(
    summaries.map((s) => s.label),
    ["Biss 1", "Biss 2", "Tunnel 1", "Welt-Spalt"],
  );
  assert.deepEqual(
    summaries.map((s) => s.id),
    ["b1", "b2", "t1", "welt-spalt"],
  );
});

test("removeCarveOpById removes only the match and keeps order", () => {
  const removed = removeCarveOpById(ops, "b2");
  assert.deepEqual(
    removed.map((o) => o.id),
    ["b1", "t1", "welt-spalt"],
  );
  assert.deepEqual(
    removeCarveOpById(ops, "unbekannt").map((o) => o.id),
    ops.map((o) => o.id),
    "unknown id is a no-op",
  );
});

test("makeBiteOp/makeTunnelOp clamp minimum radii and keep coordinates", () => {
  const bite = makeBiteOp([0.5, 0.1, 0.2], 0.05, 3);
  assert.equal(bite.kind, "bite");
  assert.equal(bite.radius, 0.12, "bite radius clamped up");
  assert.deepEqual(bite.center, [0.5, 0.1, 0.2]);
  assert.ok(bite.id.startsWith("biss-"));

  const tunnel = makeTunnelOp([0, 0, 0], [1, 0, 0], 0.05, 4);
  assert.equal(tunnel.kind, "tunnel");
  assert.equal(tunnel.radius, 0.08, "tunnel radius clamped up");
  assert.ok(tunnel.id.startsWith("tunnel-"));

  const wide = makeBiteOp([0, 0, 1], 0.6, 5);
  assert.equal(wide.radius, 0.6, "large brush wins over the clamp");
});
