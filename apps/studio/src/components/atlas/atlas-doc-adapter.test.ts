import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPaletteIdMap, buildStudioAtlasDoc } from "./atlas-doc-adapter";
import { DEFAULT_TERRAIN_BLEND_WIDTH } from "@uwe/atlas/doc";
import type { StudioAtlasFeatureInput, StudioAtlasObjectInput } from "./atlas-doc-adapter";

const feature: StudioAtlasFeatureInput = {
  id: "f1",
  kind: "biome",
  geometry: { type: "Polygon", rings: [[[0.1, 0.1], [0.2, 0.1], [0.2, 0.2]]] },
  style: { biomeKind: "forest", density: 1 },
  labelText: null,
  labelColor: null,
  layer: 10,
  sortOrder: 0,
  visibility: "dm_only",
  _key: "ck-1",
};
const object: StudioAtlasObjectInput = {
  id: "o1",
  paletteItemId: "pi_castle",
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  style: { gouache: "castle", lineWidth: 1.2, blur: 0.5 },
  layer: 50,
  visibility: "dm_only",
  _key: "ck-2",
};

describe("buildStudioAtlasDoc", () => {
  it("produces a v2 doc rooted at the current node with a linked parent chain", () => {
    const doc = buildStudioAtlasDoc({
      worldSlug: "terra",
      node: { id: "n-city", title: "Validori", level: "city", visibility: "player_visible" },
      parentChain: [
        { id: "n-root", title: "Westland", level: "continent" },
        { id: "n-region", title: "Ostmark", level: "landscape" },
      ],
      features: [feature],
      objects: [object],
      stylePreset: "tolkien-ink",
      mapVisibility: "dm_only",
    });

    assert.equal(doc.schemaVersion, 2);
    assert.equal(doc.worldSlug, "terra");
    assert.equal(doc.rootNodeId, "n-city");
    // parent chain linked: root(null) → region(root) → city(region)
    assert.equal(doc.nodes.length, 3);
    assert.equal((doc.nodes[0] as { parentId: unknown }).parentId, null);
    assert.equal((doc.nodes[1] as { parentId: unknown }).parentId, "n-root");
    assert.equal((doc.nodes[2] as { id: unknown; parentId: unknown }).parentId, "n-region");
    assert.equal((doc.nodes[2] as { visibility: unknown }).visibility, "player_visible");
    // features/objects stamped with the current nodeId, keys preserved
    assert.equal((doc.features[0] as { nodeId: unknown }).nodeId, "n-city");
    assert.equal((doc.features[0] as { _key: unknown })._key, "ck-1");
    assert.equal((doc.objects[0] as { nodeId: unknown }).nodeId, "n-city");
    assert.equal((doc.objects[0] as { paletteItemId: unknown }).paletteItemId, "pi_castle");
    assert.deepEqual((doc.objects[0] as { style: unknown }).style, {
      gouache: "castle",
      lineWidth: 1.2,
      blur: 0.5,
    });
  });

  it("defaults to an empty tile layer when none is provided", () => {
    const doc = buildStudioAtlasDoc({
      worldSlug: "terra",
      node: { id: "n1", title: "N", level: "continent" },
      parentChain: [],
      features: [],
      objects: [],
    });
    assert.deepEqual(doc.tileLayer, {
      cols: 64,
      rows: 40,
      tile: 32,
      cells: {},
      blendWidth: DEFAULT_TERRAIN_BLEND_WIDTH,
    });
    assert.equal(doc.nodes.length, 1);
  });

  it("preserves an existing tile layer", () => {
    const tileLayer = { cols: 64, rows: 40, tile: 32, cells: { "3,4": "coast" }, blendWidth: 0 };
    const doc = buildStudioAtlasDoc({
      worldSlug: "terra",
      node: { id: "n1", title: "N", level: "continent" },
      parentChain: [],
      features: [],
      objects: [],
      tileLayer,
    });
    assert.deepEqual(doc.tileLayer.cells, { "3,4": "coast" });
    assert.equal(doc.tileLayer.blendWidth, 0);
  });
});

describe("buildPaletteIdMap", () => {
  it("maps builtin glyph keys to DB ids and passes real ids through", () => {
    const map = buildPaletteIdMap([
      { id: "pi_castle", builtinGlyphKey: "castle" },
      { id: "pi_ai_1", builtinGlyphKey: null },
    ]);
    assert.equal(map["castle"], "pi_castle"); // glyph key → DB id
    assert.equal(map["pi_castle"], "pi_castle"); // real id → itself
    assert.equal(map["pi_ai_1"], "pi_ai_1");
    assert.equal(map["unknown"], undefined);
  });
});
