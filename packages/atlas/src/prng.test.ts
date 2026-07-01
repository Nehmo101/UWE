import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mulberry32, hashStringToSeed } from "./prng";

describe("mulberry32 — determinism", () => {
  it("same seed → identical stream", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      assert.equal(a(), b(), `value[${i}] must match for equal seeds`);
    }
  });

  it("different seeds → diverging streams", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const av: number[] = [];
    const bv: number[] = [];
    for (let i = 0; i < 20; i++) {
      av.push(a());
      bv.push(b());
    }
    assert.notDeepEqual(av, bv, "different seeds should not produce the same stream");
  });

  it("emits values in [0, 1)", () => {
    const r = mulberry32(0xdeadbeef);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      assert.ok(v >= 0 && v < 1, `value ${v} out of [0, 1)`);
    }
  });

  it("golden regression — first values for a fixed seed are locked", () => {
    // Locks the exact stream so a future refactor of the PRNG (or folding the
    // duplicated makePrng copies into this module) cannot silently drift.
    const r = mulberry32(12345);
    const got = [r(), r(), r(), r(), r()];
    assert.deepEqual(got, [
      0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203,
      0.5094283693470061,
    ]);
  });
});

describe("hashStringToSeed", () => {
  it("is deterministic and unsigned-32-bit", () => {
    assert.equal(hashStringToSeed("terra"), 110250512);
    assert.equal(hashStringToSeed("seed-abc"), 988617478);
    const h = hashStringToSeed("anything");
    assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff, "must be uint32");
  });

  it("distinct strings generally hash to distinct seeds", () => {
    assert.notEqual(hashStringToSeed("a"), hashStringToSeed("b"));
    assert.notEqual(hashStringToSeed("terra"), hashStringToSeed("terra "));
  });
});
