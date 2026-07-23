import assert from "node:assert/strict";
import { test } from "node:test";
import { warpObjects, type WarpObject } from "./warp";

test("terrain warp: full shift at the centre, barely any at the rim, none outside", () => {
  const objects: readonly WarpObject[] = [
    { localId: "centre", position: { x: 0, z: 0 } },
    { localId: "rim", position: { x: 0.29, z: 0 } },
    { localId: "outside", position: { x: 2, z: 0 } },
  ];
  const moved = warpObjects({
    objects,
    mode: "terrain",
    center: [0, 0, 0],
    delta: [0.2, 0, 0.1],
    radius: 0.3,
  });
  const centre = moved.get("centre");
  assert.ok(centre, "centre object moved");
  assert.ok(Math.abs((centre.x as number) - 0.2) < 1e-9, "centre gets the full delta");
  assert.ok(Math.abs((centre.z as number) - 0.1) < 1e-9);
  const rim = moved.get("rim");
  assert.ok(rim, "rim object still inside the radius");
  assert.ok((rim.x as number) - 0.29 < 0.005, "rim barely moves");
  assert.equal(moved.get("outside"), undefined, "outside the radius stays untouched");
});

test("orbit and mismatching objects are never warped", () => {
  const objects: readonly WarpObject[] = [
    { localId: "orbit", position: { orbitRadius: 1.5, phase: 0.2 } },
    { localId: "dir-on-terrain", position: { dir: [0, 1, 0] } },
    { localId: "flat", position: { x: 0.01, z: 0.01 } },
  ];
  const moved = warpObjects({ objects, mode: "terrain", center: [0, 0, 0], delta: [0.1, 0, 0], radius: 0.5 });
  assert.equal(moved.has("orbit"), false);
  assert.equal(moved.has("dir-on-terrain"), false, "terrain mode ignores dir positions");
  assert.ok(moved.has("flat"));

  const globeMoved = warpObjects({ objects, mode: "globe", center: [0, 1, 0], delta: [0.1, 0, 0], radius: 0.5 });
  assert.equal(globeMoved.has("orbit"), false);
  assert.equal(globeMoved.has("flat"), false, "globe mode ignores {x,z} positions");
  assert.ok(globeMoved.has("dir-on-terrain"));
});

test("globe warp keeps unit directions and falls off with angle", () => {
  const objects: readonly WarpObject[] = [
    { localId: "pole", position: { dir: [0, 1, 0] } },
    { localId: "near", position: { dir: [Math.sin(0.25), Math.cos(0.25), 0] } },
    { localId: "far", position: { dir: [1, 0, 0] } },
  ];
  const moved = warpObjects({ objects, mode: "globe", center: [0, 1, 0], delta: [0.2, 0, 0], radius: 0.3 });
  assert.equal(moved.has("far"), false, "outside the angular radius");
  const pole = moved.get("pole");
  const near = moved.get("near");
  assert.ok(pole && near);
  for (const position of [pole, near]) {
    const dir = position.dir as [number, number, number];
    assert.ok(Math.abs(Math.hypot(...dir) - 1) < 1e-9, "dir stays a unit vector");
  }
  const poleShift = (pole.dir as number[])[0];
  const nearShift = (near.dir as number[])[0] - Math.sin(0.25);
  assert.ok(poleShift > nearShift, "centre moves more than the rim");
});

test("warp is deterministic (pure function of its inputs)", () => {
  const objects: readonly WarpObject[] = [
    { localId: "a", position: { x: 0.1, z: 0.1 } },
    { localId: "b", position: { x: -0.2, z: 0.05 } },
  ];
  const options = { objects, mode: "terrain" as const, center: [0, 0, 0] as [number, number, number], delta: [0.1, 0, -0.1] as [number, number, number], radius: 0.4 };
  assert.deepEqual(warpObjects(options), warpObjects(options));
});
