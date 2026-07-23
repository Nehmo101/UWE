import assert from "node:assert/strict";
import { test } from "node:test";
import { heightmapToJson, createHeightmap } from "./planet-field";
import { HeightLayerSession } from "./editor-height-layers";

test("session starts with a fresh Basis stack when nothing is stored", () => {
  const session = new HeightLayerSession(8, 4, null, null);
  const list = session.list();
  assert.deepEqual(list, [{ id: "ebene-1", name: "Basis", visible: true, active: true }]);
  assert.equal(session.composite().width, 8);
  assert.equal(session.composite().height, 4);
});

test("session migrates a legacy single heightmap into the Basis layer", () => {
  const legacy = createHeightmap(4, 2);
  legacy.data[1] = 0.5;
  const session = new HeightLayerSession(8, 4, null, heightmapToJson(legacy));
  assert.equal(session.list().length, 1);
  assert.equal(session.composite().width, 4, "gespeicherte Größe gewinnt über den Fallback");
  assert.equal(session.composite().data[1], 0.5);
});

test("sculpting writes into the active layer; composite is the visible sum", () => {
  const session = new HeightLayerSession(4, 2, null, null);
  session.activeGrid().data[0] = 1;
  session.add("Berge");
  session.activeGrid().data[0] = 2;
  assert.equal(session.composite().data[0], 3);
  const berge = session.list().find((l) => l.name === "Berge");
  assert.ok(berge, "Berge-Layer existiert");
  assert.ok(berge.active, "neuer Layer wird aktiv");
  session.setVisible(berge.id, false);
  assert.equal(session.composite().data[0], 1, "unsichtbarer Layer fällt aus der Summe");
});

test("composite is cached and invalidated by mutations", () => {
  const session = new HeightLayerSession(4, 2, null, null);
  const first = session.composite();
  assert.equal(session.composite(), first, "unverändert → identisches Grid-Objekt");
  session.activeGrid().data[2] = 0.25;
  const second = session.composite();
  assert.notEqual(second, first, "activeGrid() invalidiert den Cache");
  assert.equal(second.data[2], Float32Array.of(0.25)[0]);
});

test("load keeps the active layer when it still exists, otherwise falls back", () => {
  const session = new HeightLayerSession(4, 2, null, null);
  session.add("Berge");
  const snapshotWithBerge = session.toJson();
  const activeId = session.list().find((l) => l.active)?.id;
  session.load(snapshotWithBerge, null);
  assert.equal(session.list().find((l) => l.active)?.id, activeId, "Aktiv-Layer überlebt das Laden");
  // Stand ohne den aktiven Layer (Legacy) → aktiv fällt auf den ersten Layer zurück
  session.load(null, heightmapToJson(createHeightmap(4, 2)));
  assert.deepEqual(
    session.list().map((l) => ({ name: l.name, active: l.active })),
    [{ name: "Basis", active: true }],
  );
});

test("remove clamps to one layer and re-targets the active id", () => {
  const session = new HeightLayerSession(4, 2, null, null);
  session.add("Berge");
  const bergeId = session.list().find((l) => l.name === "Berge")?.id ?? "";
  assert.equal(session.remove(bergeId), true);
  assert.deepEqual(session.list()[0].active, true, "aktiv wandert zum ersten Layer");
  assert.equal(session.remove(session.list()[0].id), false, "letzter Layer bleibt");
  assert.equal(session.setActive("gibt-es-nicht"), false);
  assert.equal(session.move(session.list()[0].id, "hoch"), false);
});
