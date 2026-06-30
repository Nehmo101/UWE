import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  randomStampVariation,
  stampSeedFromKey,
} from "./stamp-variation";

// ---------------------------------------------------------------------------
// randomStampVariation / determinism
// ---------------------------------------------------------------------------

describe("randomStampVariation / determinism", () => {
  it("same seed → identical output (deep equal)", () => {
    const a = randomStampVariation(1337);
    const b = randomStampVariation(1337);
    assert.deepEqual(a, b);
  });

  it("same seed + same options → identical output", () => {
    const opts = { scaleMin: 0.5, scaleMax: 2, rotateMin: -90, rotateMax: 90 };
    const a = randomStampVariation(42, opts);
    const b = randomStampVariation(42, opts);
    assert.deepEqual(a, b);
  });

  it("different seeds generally differ", () => {
    let differingScale = 0;
    let differingRotation = 0;
    for (let seed = 0; seed < 50; seed++) {
      const a = randomStampVariation(seed);
      const b = randomStampVariation(seed + 1);
      if (a.scale !== b.scale) differingScale++;
      if (a.rotation !== b.rotation) differingRotation++;
    }
    assert.ok(differingScale > 40, "scales should differ across most seeds");
    assert.ok(differingRotation > 40, "rotations should differ across most seeds");
  });
});

// ---------------------------------------------------------------------------
// randomStampVariation / default ranges
// ---------------------------------------------------------------------------

describe("randomStampVariation / default ranges", () => {
  it("respects default scale [0.7, 1.3] and rotation [-15, 15] across many seeds", () => {
    for (let seed = -100; seed <= 100; seed++) {
      const { scale, rotation } = randomStampVariation(seed);
      assert.ok(scale >= 0.7 && scale <= 1.3, `scale ${scale} out of [0.7,1.3]`);
      assert.ok(rotation >= -15 && rotation <= 15, `rotation ${rotation} out of [-15,15]`);
      assert.ok(scale > 0, "scale must be positive");
    }
  });
});

// ---------------------------------------------------------------------------
// randomStampVariation / custom ranges
// ---------------------------------------------------------------------------

describe("randomStampVariation / custom ranges", () => {
  it("respects custom ranges across many seeds", () => {
    const opts = { scaleMin: 1, scaleMax: 4, rotateMin: 0, rotateMax: 360 };
    for (let seed = 0; seed < 200; seed++) {
      const { scale, rotation } = randomStampVariation(seed, opts);
      assert.ok(scale >= 1 && scale <= 4, `scale ${scale} out of [1,4]`);
      assert.ok(rotation >= 0 && rotation <= 360, `rotation ${rotation} out of [0,360]`);
    }
  });

  it("handles swapped scale min/max (min > max)", () => {
    const swapped = randomStampVariation(7, { scaleMin: 1.3, scaleMax: 0.7 });
    const normal = randomStampVariation(7, { scaleMin: 0.7, scaleMax: 1.3 });
    assert.deepEqual(swapped, normal);
    assert.ok(swapped.scale >= 0.7 && swapped.scale <= 1.3);
  });

  it("handles swapped rotation min/max (min > max)", () => {
    const swapped = randomStampVariation(7, { rotateMin: 15, rotateMax: -15 });
    const normal = randomStampVariation(7, { rotateMin: -15, rotateMax: 15 });
    assert.deepEqual(swapped, normal);
    assert.ok(swapped.rotation >= -15 && swapped.rotation <= 15);
  });

  it("guards scale > 0 even when range allows zero/negative", () => {
    for (let seed = 0; seed < 200; seed++) {
      const { scale } = randomStampVariation(seed, { scaleMin: -1, scaleMax: 0 });
      assert.ok(scale > 0, `scale ${scale} must be strictly positive`);
    }
  });

  it("degenerate range (min == max) returns the exact bound", () => {
    const v = randomStampVariation(99, {
      scaleMin: 1,
      scaleMax: 1,
      rotateMin: 5,
      rotateMax: 5,
    });
    assert.equal(v.scale, 1);
    assert.equal(v.rotation, 5);
  });
});

// ---------------------------------------------------------------------------
// stampSeedFromKey
// ---------------------------------------------------------------------------

describe("stampSeedFromKey", () => {
  it("is deterministic — same key → same seed", () => {
    assert.equal(stampSeedFromKey("tree-001"), stampSeedFromKey("tree-001"));
  });

  it("returns a finite integer", () => {
    for (const key of ["", "a", "house", "tree-001", "🌲 stamp", "Ünïcødé"]) {
      const seed = stampSeedFromKey(key);
      assert.ok(Number.isFinite(seed), `${key} must yield a finite seed`);
      assert.ok(Number.isInteger(seed), `${key} must yield an integer seed`);
    }
  });

  it("different keys generally produce different seeds", () => {
    const keys = ["tree", "house", "rock", "bridge", "tower", "well"];
    const seeds = new Set(keys.map(stampSeedFromKey));
    assert.equal(seeds.size, keys.length, "distinct keys should map to distinct seeds");
  });

  it("composes with randomStampVariation deterministically", () => {
    const seed = stampSeedFromKey("forest/tree/42");
    const a = randomStampVariation(seed);
    const b = randomStampVariation(stampSeedFromKey("forest/tree/42"));
    assert.deepEqual(a, b);
  });
});
