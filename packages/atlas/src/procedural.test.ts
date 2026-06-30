import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateDraft, rerollDraft } from "./procedural";

// ---------------------------------------------------------------------------
// generateDraft — determinism
// ---------------------------------------------------------------------------

describe("generateDraft — determinism", () => {
  it("same seed → identical feature count and ids", () => {
    const a = generateDraft(42);
    const b = generateDraft(42);
    assert.equal(a.features.length, b.features.length, "feature count must match");
    for (let i = 0; i < a.features.length; i++) {
      assert.equal(a.features[i]!.id, b.features[i]!.id, `id[${i}] must match`);
      assert.equal(a.features[i]!.kind, b.features[i]!.kind, `kind[${i}] must match`);
    }
  });

  it("same seed → identical geometries (deep equal)", () => {
    const a = generateDraft(999);
    const b = generateDraft(999);
    assert.deepEqual(a.features, b.features);
  });

  it("different seeds → different output", () => {
    const a = generateDraft(1);
    const b = generateDraft(2);
    // At minimum the seed field should differ
    assert.notEqual(a.seed, b.seed);
    // Feature geometries should differ
    const aFirst = JSON.stringify(a.features[0]?.geometry);
    const bFirst = JSON.stringify(b.features[0]?.geometry);
    assert.notEqual(aFirst, bFirst, "different seeds should produce different geometries");
  });
});

// ---------------------------------------------------------------------------
// generateDraft — structure
// ---------------------------------------------------------------------------

describe("generateDraft — structure", () => {
  it("returns the correct seed on the draft", () => {
    const draft = generateDraft(12345);
    assert.equal(draft.seed, 12345);
  });

  it("always has at least one coastline feature", () => {
    for (const seed of [0, 1, 42, 9999, 0xdeadbeef]) {
      const draft = generateDraft(seed);
      const coastlines = draft.features.filter((f) => f.kind === "coastline");
      assert.ok(coastlines.length >= 1, `seed ${seed}: must have ≥1 coastline`);
    }
  });

  it("always has at least one region feature", () => {
    for (const seed of [0, 42, 777]) {
      const draft = generateDraft(seed);
      const regions = draft.features.filter((f) => f.kind === "region");
      assert.ok(regions.length >= 1, `seed ${seed}: must have ≥1 region`);
    }
  });

  it("all feature ids are unique within a draft", () => {
    const draft = generateDraft(7);
    const ids = draft.features.map((f) => f.id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, "all feature ids must be unique");
  });

  it("all features have a valid atlasKind", () => {
    const validKinds = new Set(["region", "river", "road", "biome", "relief", "label", "pin"]);
    const draft = generateDraft(100);
    for (const feat of draft.features) {
      assert.ok(validKinds.has(feat.atlasKind), `invalid atlasKind: ${feat.atlasKind}`);
    }
  });

  it("coastline geometry is a Polygon", () => {
    const draft = generateDraft(77);
    const coast = draft.features.find((f) => f.kind === "coastline");
    assert.ok(coast, "must have a coastline feature");
    assert.equal(coast.geometry.type, "Polygon");
  });

  it("region geometry is a Polygon", () => {
    const draft = generateDraft(55);
    const regions = draft.features.filter((f) => f.kind === "region");
    for (const region of regions) {
      assert.equal(region.geometry.type, "Polygon");
    }
  });

  it("mountain geometry is a Path", () => {
    const draft = generateDraft(33);
    const mountains = draft.features.filter((f) => f.kind === "mountain");
    for (const m of mountains) {
      assert.equal(m.geometry.type, "Path");
    }
  });

  it("river geometry is a Path", () => {
    const draft = generateDraft(22);
    const rivers = draft.features.filter((f) => f.kind === "river");
    for (const r of rivers) {
      assert.equal(r.geometry.type, "Path");
    }
  });

  it("city geometry is a Point", () => {
    const draft = generateDraft(11);
    const cities = draft.features.filter((f) => f.kind === "city");
    for (const c of cities) {
      assert.equal(c.geometry.type, "Point");
    }
  });

  it("forest geometry is a Polygon", () => {
    const draft = generateDraft(88);
    const forests = draft.features.filter((f) => f.kind === "forest");
    for (const f of forests) {
      assert.equal(f.geometry.type, "Polygon");
    }
  });

  it("all coordinates are within [0, 1] bounds (default)", () => {
    const draft = generateDraft(555);
    function checkCoord(x: number, y: number) {
      assert.ok(x >= 0 && x <= 1, `x=${x} out of [0,1]`);
      assert.ok(y >= 0 && y <= 1, `y=${y} out of [0,1]`);
    }
    for (const feat of draft.features) {
      const g = feat.geometry;
      if (g.type === "Point") {
        const [x, y] = g.coordinates;
        checkCoord(x!, y!);
      } else if (g.type === "Path") {
        for (const [x, y] of g.coordinates) {
          checkCoord(x!, y!);
        }
      } else if (g.type === "Polygon") {
        for (const ring of g.rings) {
          for (const [x, y] of ring) {
            checkCoord(x!, y!);
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// generateDraft — prompt hints
// ---------------------------------------------------------------------------

describe("generateDraft — promptHints", () => {
  it("regionCount hint is respected (within clamped range)", () => {
    for (const count of [1, 2, 4, 6]) {
      const draft = generateDraft(42, { regionCount: count });
      const regions = draft.features.filter((f) => f.kind === "region");
      assert.equal(regions.length, count, `expected ${count} regions`);
    }
  });

  it("regionCount is clamped to max 8", () => {
    const draft = generateDraft(42, { regionCount: 100 });
    const regions = draft.features.filter((f) => f.kind === "region");
    assert.ok(regions.length <= 8);
  });

  it("regionCount is clamped to min 1", () => {
    const draft = generateDraft(42, { regionCount: 0 });
    const regions = draft.features.filter((f) => f.kind === "region");
    assert.ok(regions.length >= 1);
  });

  it("cityCount hint is respected", () => {
    for (const count of [0, 1, 3, 5]) {
      const draft = generateDraft(7, { cityCount: count });
      const cities = draft.features.filter((f) => f.kind === "city");
      assert.equal(cities.length, count, `expected ${count} cities`);
    }
  });

  it("riverCount=0 produces no rivers", () => {
    const draft = generateDraft(42, { riverCount: 0 });
    const rivers = draft.features.filter((f) => f.kind === "river");
    assert.equal(rivers.length, 0);
  });

  it("promptHints are preserved on the draft", () => {
    const hints = { regionCount: 3, cityCount: 2 };
    const draft = generateDraft(99, hints);
    assert.deepEqual(draft.promptHints, hints);
  });
});

// ---------------------------------------------------------------------------
// generateDraft — custom bounds
// ---------------------------------------------------------------------------

describe("generateDraft — custom bounds", () => {
  it("respects custom bounds", () => {
    const bounds = { minX: 0.2, minY: 0.2, maxX: 0.8, maxY: 0.8 };
    const draft = generateDraft(42, undefined, bounds);
    assert.deepEqual(draft.bounds, bounds);
  });

  it("city points are within custom bounds", () => {
    const bounds = { minX: 0.3, minY: 0.3, maxX: 0.7, maxY: 0.7 };
    const draft = generateDraft(123, { cityCount: 5 }, bounds);
    const cities = draft.features.filter((f) => f.kind === "city");
    for (const city of cities) {
      const g = city.geometry;
      if (g.type === "Point") {
        const [x, y] = g.coordinates;
        assert.ok(x! >= bounds.minX && x! <= bounds.maxX, `city x=${x} outside bounds`);
        assert.ok(y! >= bounds.minY && y! <= bounds.maxY, `city y=${y} outside bounds`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// rerollDraft
// ---------------------------------------------------------------------------

describe("rerollDraft", () => {
  it("reroll with no locks produces a different draft", () => {
    const original = generateDraft(1);
    const rerolled = rerollDraft(original, 2);
    assert.notEqual(rerolled.seed, original.seed);
    const idsOrig = original.features.map((f) => f.id).join(",");
    const idsNew = rerolled.features.map((f) => f.id).join(",");
    assert.notEqual(idsOrig, idsNew, "rerolled draft should have new ids");
  });

  it("locked features are preserved in the rerolled draft", () => {
    const original = generateDraft(1);
    const toLock = [original.features[0]!.id, original.features[2]!.id];
    const rerolled = rerollDraft(original, 99, toLC(toLock));
    for (const lockedId of toLock) {
      const found = rerolled.features.find((f) => f.id === lockedId);
      assert.ok(found, `locked feature ${lockedId} must be in rerolled draft`);
      assert.ok(found.locked === true, `locked feature must have locked=true`);
    }
  });

  it("reroll with all features locked is deterministic from original", () => {
    const original = generateDraft(42);
    const allIds = original.features.map((f) => f.id);
    const rerolled = rerollDraft(original, 999, allIds);
    // All original features should be present (locked)
    for (const f of original.features) {
      const found = rerolled.features.find((r) => r.id === f.id);
      assert.ok(found, `feature ${f.id} must survive full lock`);
    }
  });

  it("rerolled draft inherits promptHints from original", () => {
    const hints = { regionCount: 2, cityCount: 3 };
    const original = generateDraft(1, hints);
    const rerolled = rerollDraft(original, 2);
    assert.deepEqual(rerolled.promptHints, hints);
  });

  it("rerolled draft inherits bounds from original", () => {
    const bounds = { minX: 0.1, minY: 0.1, maxX: 0.9, maxY: 0.9 };
    const original = generateDraft(1, undefined, bounds);
    const rerolled = rerollDraft(original, 5);
    assert.deepEqual(rerolled.bounds, bounds);
  });

  it("reroll is deterministic for same new seed", () => {
    const original = generateDraft(7);
    const toLC = [original.features[0]!.id];
    const a = rerollDraft(original, 99, toLC);
    const b = rerollDraft(original, 99, toLC);
    assert.deepEqual(a.features, b.features);
  });
});

// Helper alias to avoid shadow warning
function toLC(arr: string[]): string[] { return arr; }
