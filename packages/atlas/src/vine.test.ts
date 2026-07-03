import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildVineLayout } from "./vine";
import type { Coordinate } from "./geometry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A vertical, slightly bent stalk from base (bottom) to tip (top). */
const STALK: Coordinate[] = [
  [0.5, 0.9],
  [0.52, 0.6],
  [0.48, 0.35],
  [0.5, 0.12],
];

/** Assert every coordinate of a polyline lies in [0, 1]². */
function assertInBounds(pts: Coordinate[], label: string): void {
  for (const [x, y] of pts) {
    assert.ok(x >= 0 && x <= 1, `${label}: x ${x} out of [0,1]`);
    assert.ok(y >= 0 && y <= 1, `${label}: y ${y} out of [0,1]`);
  }
}

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("buildVineLayout / edge cases", () => {
  it("returns an empty layout for < 2 points", () => {
    for (const pts of [[], [[0.5, 0.5]] as Coordinate[]]) {
      const layout = buildVineLayout(pts as Coordinate[]);
      assert.equal(layout.spine.length, 0);
      assert.equal(layout.widths.length, 0);
      assert.equal(layout.coil.length, 0);
      assert.equal(layout.tendrils.length, 0);
      assert.equal(layout.shadow.length, 0);
      assert.equal(layout.aura.clouds.length, 0);
    }
  });
});

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe("buildVineLayout / structure", () => {
  it("keeps coil/widths/shadow aligned with the spine length", () => {
    const layout = buildVineLayout(STALK, { seed: 1 });
    assert.ok(layout.spine.length >= STALK.length, "spine is densified");
    assert.equal(layout.widths.length, layout.spine.length);
    assert.equal(layout.coil.length, layout.spine.length);
    assert.equal(layout.shadow.length, layout.spine.length);
  });

  it("emits exactly the requested number of tendrils", () => {
    for (const tendrils of [0, 1, 3, 8]) {
      const layout = buildVineLayout(STALK, { tendrils, seed: 5 });
      assert.equal(layout.tendrils.length, tendrils);
    }
  });

  it("clamps every emitted coordinate to [0, 1]", () => {
    // Force big offsets: high coil + height, tip near the map edge.
    const layout = buildVineLayout(
      [
        [0.98, 0.98],
        [0.99, 0.5],
        [0.98, 0.02],
      ],
      { coil: 1, height: 1, tendrils: 6, seed: 9 },
    );
    assertInBounds(layout.spine, "spine");
    assertInBounds(layout.coil, "coil");
    assertInBounds(layout.shadow, "shadow");
    assertInBounds(layout.aura.clouds, "aura.clouds");
    for (const t of layout.tendrils) assertInBounds(t, "tendril");
  });
});

// ---------------------------------------------------------------------------
// Taper
// ---------------------------------------------------------------------------

describe("buildVineLayout / taper", () => {
  it("tapers trunk width monotonically from base to tip", () => {
    const layout = buildVineLayout(STALK, { taperStart: 1.2, taperEnd: 0.1 });
    const w = layout.widths;
    assert.ok(Math.abs(w[0]! - 1.2) < 1e-9, "base width == taperStart");
    assert.ok(Math.abs(w[w.length - 1]! - 0.1) < 1e-9, "tip width == taperEnd");
    for (let i = 1; i < w.length; i++) {
      assert.ok(w[i]! <= w[i - 1]! + 1e-9, `width non-increasing at ${i}`);
    }
  });

  it("aura radius grows with height", () => {
    const low = buildVineLayout(STALK, { height: 0 }).aura.radius;
    const high = buildVineLayout(STALK, { height: 1 }).aura.radius;
    assert.ok(high > low, "taller vine → larger aura");
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("buildVineLayout / determinism", () => {
  it("is identical for the same seed", () => {
    const a = buildVineLayout(STALK, { seed: 42, tendrils: 5 });
    const b = buildVineLayout(STALK, { seed: 42, tendrils: 5 });
    assert.deepEqual(a, b);
  });

  it("differs for different seeds (tendril placement)", () => {
    const a = buildVineLayout(STALK, { seed: 1, tendrils: 5 });
    const b = buildVineLayout(STALK, { seed: 2, tendrils: 5 });
    assert.notDeepEqual(a.tendrils, b.tendrils);
  });

  it("coil == 0 makes the coil follow the spine exactly", () => {
    const layout = buildVineLayout(STALK, { coil: 0 });
    assert.deepEqual(layout.coil, layout.spine);
  });
});
