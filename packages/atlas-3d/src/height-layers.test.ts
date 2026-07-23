import assert from "node:assert/strict";
import { test } from "node:test";
import { heightmapToJson } from "./planet-field";
import {
  addLayer,
  compositeLayers,
  createLayerStack,
  HEIGHT_BASE_LAYER_NAME,
  layerStackFromLegacyHeightmap,
  layersFromJson,
  layersToJson,
  moveLayer,
  removeLayer,
  setLayerVisible,
} from "./height-layers";

test("createLayerStack starts with one visible Basis layer", () => {
  const stack = createLayerStack(8, 4);
  assert.equal(stack.layers.length, 1);
  assert.equal(stack.layers[0].name, HEIGHT_BASE_LAYER_NAME);
  assert.equal(stack.layers[0].visible, true);
  assert.equal(stack.layers[0].grid.width, 8);
  assert.equal(stack.layers[0].grid.height, 4);
  assert.ok(stack.layers[0].grid.data.every((v) => v === 0));
});

test("compositeLayers sums all visible layers texel by texel", () => {
  const stack = createLayerStack(4, 2);
  stack.layers[0].grid.data[3] = 0.5;
  const berge = addLayer(stack, "Berge");
  berge.grid.data[3] = 0.25;
  berge.grid.data[0] = -0.1;
  const composite = compositeLayers(stack.layers);
  assert.equal(composite.data[3], Float32Array.of(0.75)[0]);
  assert.equal(composite.data[0], Float32Array.of(-0.1)[0]);
  assert.equal(composite.data[1], 0);
});

test("invisible layers are excluded from the composite", () => {
  const stack = createLayerStack(4, 2);
  stack.layers[0].grid.data[1] = 1;
  const extra = addLayer(stack, "Täler");
  extra.grid.data[1] = 2;
  assert.equal(setLayerVisible(stack, extra.id, false), true);
  assert.equal(compositeLayers(stack.layers).data[1], 1);
  assert.equal(setLayerVisible(stack, extra.id, true), true);
  assert.equal(compositeLayers(stack.layers).data[1], 3);
  assert.equal(setLayerVisible(stack, "gibt-es-nicht", false), false);
});

test("json roundtrip preserves order, ids, names, visibility and data", () => {
  const stack = createLayerStack(4, 3);
  stack.layers[0].grid.data[2] = 0.5;
  const berge = addLayer(stack, "Berge");
  berge.grid.data[7] = -0.25;
  berge.visible = false;
  const restored = layersFromJson(JSON.parse(JSON.stringify(layersToJson(stack))));
  assert.ok(restored);
  assert.equal(restored.width, 4);
  assert.equal(restored.height, 3);
  assert.deepEqual(
    restored.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible })),
    [
      { id: "ebene-1", name: HEIGHT_BASE_LAYER_NAME, visible: true },
      { id: berge.id, name: "Berge", visible: false },
    ],
  );
  assert.deepEqual(Array.from(restored.layers[0].grid.data), Array.from(stack.layers[0].grid.data));
  assert.deepEqual(Array.from(restored.layers[1].grid.data), Array.from(berge.grid.data));
});

test("layersFromJson rejects malformed input", () => {
  assert.equal(layersFromJson(null), null);
  assert.equal(layersFromJson({ version: 1, layers: [] }), null);
  assert.equal(layersFromJson({ version: 2, layers: [] }), null);
  const good = layersToJson(createLayerStack(4, 2));
  // doppelte Ids
  assert.equal(layersFromJson({ version: 1, layers: [good.layers[0], good.layers[0]] }), null);
  // abweichende Grid-Größen
  const other = layersToJson(createLayerStack(2, 2));
  assert.equal(
    layersFromJson({ version: 1, layers: [good.layers[0], { ...other.layers[0], id: "ebene-9" }] }),
    null,
  );
  // kaputtes Grid
  assert.equal(
    layersFromJson({ version: 1, layers: [{ id: "a", name: "x", visible: true, grid: { nope: true } }] }),
    null,
  );
});

test("legacy migration wraps a single heightmap json into a Basis layer stack", () => {
  const legacy = createLayerStack(4, 2).layers[0].grid;
  legacy.data[5] = 0.75;
  const stack = layerStackFromLegacyHeightmap(heightmapToJson(legacy));
  assert.ok(stack);
  assert.equal(stack.layers.length, 1);
  assert.equal(stack.layers[0].name, HEIGHT_BASE_LAYER_NAME);
  assert.equal(stack.layers[0].visible, true);
  assert.deepEqual(Array.from(stack.layers[0].grid.data), Array.from(legacy.data));
  assert.equal(layerStackFromLegacyHeightmap(null), null);
  assert.equal(layerStackFromLegacyHeightmap({ kaputt: true }), null);
});

test("removeLayer never removes the last layer and handles unknown ids", () => {
  const stack = createLayerStack(4, 2);
  assert.equal(removeLayer(stack, stack.layers[0].id), false);
  const extra = addLayer(stack, "Berge");
  assert.equal(removeLayer(stack, "gibt-es-nicht"), false);
  assert.equal(stack.layers.length, 2);
  assert.equal(removeLayer(stack, extra.id), true);
  assert.equal(stack.layers.length, 1);
  assert.equal(removeLayer(stack, stack.layers[0].id), false, "letzter Layer bleibt unlöschbar");
});

test("moveLayer swaps neighbors, clamps at the edges and keeps the composite sum", () => {
  const stack = createLayerStack(4, 2);
  const b = addLayer(stack, "B");
  const c = addLayer(stack, "C");
  stack.layers[0].grid.data[0] = 1;
  b.grid.data[0] = 2;
  c.grid.data[0] = 4;
  const before = compositeLayers(stack.layers).data[0];
  assert.equal(moveLayer(stack, stack.layers[0].id, "hoch"), false, "oberster Layer bleibt oben");
  assert.equal(moveLayer(stack, c.id, "runter"), false, "unterster Layer bleibt unten");
  assert.equal(moveLayer(stack, b.id, "hoch"), true);
  assert.deepEqual(
    stack.layers.map((l) => l.name),
    ["B", HEIGHT_BASE_LAYER_NAME, "C"],
  );
  assert.equal(moveLayer(stack, b.id, "runter"), true);
  assert.deepEqual(
    stack.layers.map((l) => l.name),
    [HEIGHT_BASE_LAYER_NAME, "B", "C"],
  );
  assert.equal(moveLayer(stack, "gibt-es-nicht", "hoch"), false);
  assert.equal(compositeLayers(stack.layers).data[0], before, "Summe ist reihenfolgeunabhängig");
});

test("addLayer ids stay unique after remove/add and empty names get a default", () => {
  const stack = createLayerStack(4, 2);
  const b = addLayer(stack, "  ");
  assert.equal(b.name, "Ebene 2");
  assert.equal(b.id, "ebene-2");
  assert.equal(removeLayer(stack, b.id), true);
  const c = addLayer(stack, "Küste");
  assert.equal(c.id, "ebene-2", "Nummer wird nach Entfernen wiederverwendet — trotzdem eindeutig");
  const d = addLayer(stack, "Riff");
  assert.equal(d.id, "ebene-3");
  assert.equal(new Set(stack.layers.map((l) => l.id)).size, stack.layers.length);
});
