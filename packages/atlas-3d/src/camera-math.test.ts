import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cameraPosition, clampPitch, createOrbitState, reduceOrbit, screenRay, worldToScreen } from "./camera-math";

describe("orbit camera math", () => {
  it("clamps pitch and dolly limits", () => {
    assert.equal(clampPitch(-90), 12);
    assert.equal(clampPitch(120), 89);
    const initial = createOrbitState({ pitch: 40, distance: 2 });
    assert.equal(reduceOrbit(initial, { type: "orbit", deltaYaw: 0, deltaPitch: 100 }).pitch, 89);
    assert.equal(reduceOrbit(initial, { type: "dolly", factor: 0.001 }).distance, 0.35);
  });

  it("produces a golden centre ray towards the target", () => {
    const state = createOrbitState({ target: [0, 0, 0], yaw: 0, pitch: 45, distance: 2, aspect: 2 });
    const ray = screenRay(state, [500, 250], [1000, 500]);
    assert.deepEqual(ray.origin, cameraPosition(state));
    assert.ok(Math.abs(ray.direction[0]) < 1e-12);
    assert.ok(Math.abs(ray.direction[1] + Math.SQRT1_2) < 1e-12);
    assert.ok(Math.abs(ray.direction[2] + Math.SQRT1_2) < 1e-12);
  });

  it("round-trips projected ground points over a screen grid", () => {
    const state = createOrbitState({ target: [0, 0, 0], yaw: -24, pitch: 56, distance: 2.4, aspect: 16 / 9 });
    const viewport = [1280, 720] as const;
    for (const point of [[-0.7, 0, -0.4], [0, 0, 0], [0.6, 0, 0.35]] as const) {
      const screen = worldToScreen(state, point, viewport);
      assert.ok(screen);
      const ray = screenRay(state, screen, viewport);
      const distance = -ray.origin[1] / ray.direction[1];
      const hit = [ray.origin[0] + ray.direction[0] * distance, ray.origin[2] + ray.direction[2] * distance];
      assert.ok(Math.hypot(hit[0] - point[0], hit[1] - point[2]) < 1e-8);
    }
  });
});
