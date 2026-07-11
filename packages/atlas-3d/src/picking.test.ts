import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createOrbitState, screenRay, worldToScreen } from "./camera-math";
import { raycastHeightfield } from "./picking";

describe("heightfield picking", () => {
  it("round-trips flat world positions through screen space", () => {
    const state = createOrbitState({ target: [0, 0, 0], yaw: -30, pitch: 55, distance: 2.3, aspect: 16 / 9 });
    const viewport = [1280, 720] as const;
    const grid = { cols: 8, rows: 5 };
    for (const [nx, ny] of [[0.2, 0.25], [0.5, 0.5], [0.8, 0.7]] as const) {
      const screen = worldToScreen(state, [(nx - 0.5) * 2, 0, (ny - 0.5) * 1.25], viewport);
      assert.ok(screen);
      const hit = raycastHeightfield(screenRay(state, screen, viewport), grid);
      assert.ok(hit);
      assert.ok(Math.hypot(hit[0] - nx, hit[1] - ny) < 2e-3);
    }
  });

  it("falls back to the ground plane without elevation", () => {
    const hit = raycastHeightfield({ origin: [0, 1, 0], direction: [0, -1, 0] }, { cols: 2, rows: 2 });
    assert.deepEqual(hit, [0.5, 0.5]);
  });
});
