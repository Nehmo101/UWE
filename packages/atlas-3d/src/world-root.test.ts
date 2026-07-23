import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { buildWorldRootBridge } from "./world-root";

function buildOptions(count: number, seed = 7) {
  return {
    normal: new THREE.Vector3(1, 0, 0),
    gap: 0.4,
    planetRadius: 1,
    count,
    seed,
  };
}

function rootGeometries(group: THREE.Group): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) geometries.push(child.geometry as THREE.BufferGeometry);
  });
  return geometries;
}

test("bridge builds outline + fill meshes per root", () => {
  const bridge = buildWorldRootBridge(buildOptions(9));
  assert.equal(bridge.group.children.length, 18, "two meshes (outline + fill) per root");
  bridge.dispose();
});

test("root count is respected across the whole range", () => {
  for (const count of [1, 6, 16]) {
    const bridge = buildWorldRootBridge(buildOptions(count));
    assert.equal(bridge.group.children.length, count * 2);
    bridge.dispose();
  }
});

test("strands converge into an apple-core waist at mid-gap", () => {
  const bridge = buildWorldRootBridge(buildOptions(8));
  // Split normal is +X: axial coordinate = x, radial distance = hypot(y, z).
  let maxRadialMid = 0;
  let maxRadialEnd = 0;
  for (const geometry of rootGeometries(bridge.group)) {
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const radial = Math.hypot(positions.getY(i), positions.getZ(i));
      if (Math.abs(x) < 0.05) maxRadialMid = Math.max(maxRadialMid, radial);
      else if (Math.abs(x) > 0.3) maxRadialEnd = Math.max(maxRadialEnd, radial);
    }
  }
  assert.ok(maxRadialEnd > 0.25, "strands fan out at the cut faces");
  assert.ok(maxRadialMid < maxRadialEnd * 0.6, "waist is pinched toward the split axis");
  bridge.dispose();
});

test("geometry is deterministic per seed", () => {
  const a = buildWorldRootBridge(buildOptions(5, 42));
  const b = buildWorldRootBridge(buildOptions(5, 42));
  const posA = rootGeometries(a.group)[0].attributes.position;
  const posB = rootGeometries(b.group)[0].attributes.position;
  assert.equal(posA.count, posB.count);
  for (let i = 0; i < posA.count; i++) {
    assert.equal(posA.getX(i), posB.getX(i));
    assert.equal(posA.getY(i), posB.getY(i));
    assert.equal(posA.getZ(i), posB.getZ(i));
  }
  a.dispose();
  b.dispose();
});
