import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SCHEMA_VERSION, migrateDoc, serializeDoc } from "./doc";
import { AtlasParseError } from "./serialization";

// A representative v1 document (no schemaVersion, no tileLayer), shaped like the
// "Terra" / CoK demo seed (scripts/atlas-cok-demo-seed.ts). Includes two stray
// v1-only fields (preset, builtinGlyphs) that serializeDoc must canonicalise away,
// and transient _key fields on features/objects that serializeDoc must strip.
function terraV1Doc() {
  return {
    worldSlug: "terra",
    map: { id: "map_terra", title: "Atlas", stylePreset: "tolkien-ink" },
    rootNodeId: "node_root",
    preset: "tolkien-ink",
    builtinGlyphs: ["tree", "mountain"],
    pageLinks: { node_root: "page_world" },
    nodes: [
      { id: "node_root", level: "continent", title: "CoK Demo", visibility: "dm_only", sortOrder: 0 },
    ],
    features: [
      {
        _key: "f1",
        id: "feat_biome",
        nodeId: "node_root",
        kind: "biome",
        geometry: {
          type: "Polygon",
          rings: [[[0.18, 0.22], [0.55, 0.18], [0.62, 0.55], [0.24, 0.62], [0.18, 0.22]]],
        },
        style: { biomeKind: "forest", density: 1.6 },
        layer: 10,
        visibility: "dm_only",
      },
    ],
    objects: [
      { _key: "o1", paletteItemId: "pi_city", x: 0.5, y: 0.4, scale: 1, rotation: 0, layer: 50, visibility: "player_visible" },
    ],
  };
}

describe("SCHEMA_VERSION", () => {
  it("is 2", () => {
    assert.equal(SCHEMA_VERSION, 2);
  });
});

describe("migrateDoc — v1 → v2", () => {
  it("adds schemaVersion=2 and an empty tileLayer", () => {
    const migrated = migrateDoc(terraV1Doc());
    assert.equal(migrated.schemaVersion, 2);
    assert.deepEqual(migrated.tileLayer, { cols: 64, rows: 40, tile: 32, cells: {} });
  });

  it("leaves features / nodes / objects untouched", () => {
    const v1 = terraV1Doc();
    const migrated = migrateDoc(v1);
    assert.deepEqual(migrated.features, v1.features, "features unchanged (incl. _key)");
    assert.deepEqual(migrated.nodes, v1.nodes, "nodes unchanged");
    assert.deepEqual(migrated.objects, v1.objects, "objects unchanged");
  });

  it("defaults missing collections to [] and pageLinks to {}", () => {
    const migrated = migrateDoc({ worldSlug: "empty" });
    assert.deepEqual(migrated.nodes, []);
    assert.deepEqual(migrated.features, []);
    assert.deepEqual(migrated.objects, []);
    assert.deepEqual(migrated.pageLinks, {});
    assert.deepEqual(migrated.tileLayer, { cols: 64, rows: 40, tile: 32, cells: {} });
  });

  it("preserves an existing tileLayer's cells", () => {
    const migrated = migrateDoc({
      schemaVersion: 2,
      tileLayer: { cols: 64, rows: 40, tile: 32, cells: { "1,2": "forest" } },
    });
    assert.deepEqual(migrated.tileLayer.cells, { "1,2": "forest" });
  });

  it("is idempotent", () => {
    const v1 = terraV1Doc();
    const once = migrateDoc(v1);
    const twice = migrateDoc(migrateDoc(v1));
    assert.deepEqual(twice, once);
  });

  it("throws (never silent) on null / undefined / non-object / array", () => {
    assert.throws(() => migrateDoc(null), AtlasParseError);
    assert.throws(() => migrateDoc(undefined), AtlasParseError);
    assert.throws(() => migrateDoc(42), AtlasParseError);
    assert.throws(() => migrateDoc("nope"), AtlasParseError);
    assert.throws(() => migrateDoc([]), AtlasParseError);
  });
});

describe("serializeDoc", () => {
  it("strips the transient _key from features and objects", () => {
    const serialized = serializeDoc(migrateDoc(terraV1Doc()));
    for (const f of serialized.features) {
      assert.ok(!("_key" in f), "feature must not carry _key");
    }
    for (const o of serialized.objects) {
      assert.ok(!("_key" in o), "object must not carry _key");
    }
  });

  it("merges extra fields into the envelope", () => {
    const serialized = serializeDoc(migrateDoc(terraV1Doc()), { savedAt: "2026-07-01T00:00:00Z" });
    assert.equal(serialized.savedAt, "2026-07-01T00:00:00Z");
    assert.equal(serialized.schemaVersion, 2);
  });

  it("round-trips: migrate ∘ serialize is stable", () => {
    const v1 = terraV1Doc();
    const s1 = serializeDoc(migrateDoc(v1));
    const s2 = serializeDoc(migrateDoc(s1));
    assert.deepEqual(s2, s1);
  });

  it("regression: Terra v1 → migrate → serialize matches the expected canonical v2 doc", () => {
    const actual = serializeDoc(migrateDoc(terraV1Doc()));
    assert.deepEqual(actual, {
      schemaVersion: 2,
      worldSlug: "terra",
      map: { id: "map_terra", title: "Atlas", stylePreset: "tolkien-ink" },
      rootNodeId: "node_root",
      pageLinks: { node_root: "page_world" },
      nodes: [
        { id: "node_root", level: "continent", title: "CoK Demo", visibility: "dm_only", sortOrder: 0 },
      ],
      features: [
        {
          id: "feat_biome",
          nodeId: "node_root",
          kind: "biome",
          geometry: {
            type: "Polygon",
            rings: [[[0.18, 0.22], [0.55, 0.18], [0.62, 0.55], [0.24, 0.62], [0.18, 0.22]]],
          },
          style: { biomeKind: "forest", density: 1.6 },
          layer: 10,
          visibility: "dm_only",
        },
      ],
      objects: [
        { paletteItemId: "pi_city", x: 0.5, y: 0.4, scale: 1, rotation: 0, layer: 50, visibility: "player_visible" },
      ],
      tileLayer: { cols: 64, rows: 40, tile: 32, cells: {} },
    });
  });
});
