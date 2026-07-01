import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ATLAS_BRIDGE_EDITOR_SOURCE,
  ATLAS_BRIDGE_HOST_SOURCE,
  applySavedIds,
  isEditorMessage,
  isHostMessage,
  splitDocForSave,
} from "./bridge";

describe("bridge message guards", () => {
  it("accepts well-formed editor messages and checks origin + type", () => {
    assert.equal(isEditorMessage({ source: ATLAS_BRIDGE_EDITOR_SOURCE, type: "save", doc: {} }), true);
    assert.equal(isEditorMessage({ source: ATLAS_BRIDGE_EDITOR_SOURCE, type: "ready", mode: "editor" }), true);
    // wrong source (a host message must not pass the editor guard)
    assert.equal(isEditorMessage({ source: ATLAS_BRIDGE_HOST_SOURCE, type: "save" }), false);
    // unknown type
    assert.equal(isEditorMessage({ source: ATLAS_BRIDGE_EDITOR_SOURCE, type: "evil" }), false);
    // junk
    assert.equal(isEditorMessage(null), false);
    assert.equal(isEditorMessage("save"), false);
  });

  it("accepts well-formed host messages and rejects editor/unknown", () => {
    assert.equal(isHostMessage({ source: ATLAS_BRIDGE_HOST_SOURCE, type: "load", doc: {} }), true);
    assert.equal(isHostMessage({ source: ATLAS_BRIDGE_HOST_SOURCE, type: "ai-draft-result", features: [] }), true);
    assert.equal(isHostMessage({ source: ATLAS_BRIDGE_EDITOR_SOURCE, type: "load" }), false);
    assert.equal(isHostMessage({ source: ATLAS_BRIDGE_HOST_SOURCE, type: "nope" }), false);
  });
});

describe("splitDocForSave", () => {
  const doc = {
    features: [
      { _key: "ck-1", id: "f1", nodeId: "n1", kind: "biome", geometry: { type: "Polygon", rings: [] }, layer: 10, visibility: "dm_only" },
      { _key: "ck-2", nodeId: "n1", kind: "river", geometry: { type: "Path", coordinates: [] }, layer: 30, visibility: "player_visible" },
      { _key: "ck-3", nodeId: "n2", kind: "pin", geometry: { type: "Point", coordinates: [0, 0] }, layer: 50 },
    ],
    objects: [
      { _key: "ck-4", nodeId: "n1", paletteItemId: "castle", x: 0.5, y: 0.5, scale: 1, rotation: 0, layer: 50 },
      { _key: "ck-5", nodeId: "n2", paletteItemId: "pi_real", x: 0.1, y: 0.1 },
    ],
  };

  it("groups features/objects by node and renames _key → clientKey", () => {
    const payloads = splitDocForSave(doc);
    assert.equal(payloads.length, 2);
    const n1 = payloads.find((p) => p.nodeId === "n1");
    const n2 = payloads.find((p) => p.nodeId === "n2");
    assert.ok(n1 && n2);
    assert.equal(n1.features.length, 2);
    assert.equal(n1.objects.length, 1);
    assert.equal(n2.features.length, 1);
    // client key renamed, no _key leaks through
    assert.equal(n1.features[0]!.clientKey, "ck-1");
    assert.equal(n1.features[0]!.id, "f1");
    assert.ok(!("_key" in n1.features[0]!));
    // persistable fields preserved
    assert.equal(n1.features[0]!.kind, "biome");
    assert.equal(n1.features[0]!.visibility, "dm_only");
  });

  it("restricts to a single node via opts.nodeId (studio edits one node)", () => {
    const payloads = splitDocForSave(doc, { nodeId: "n2" });
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0]!.nodeId, "n2");
    assert.equal(payloads[0]!.features.length, 1);
    assert.equal(payloads[0]!.objects.length, 1);
  });

  it("resolves client palette keys to DB ids when a resolver is given", () => {
    const map: Record<string, string> = { castle: "pi_castle_db" };
    const payloads = splitDocForSave(doc, { resolvePaletteId: (k) => map[k] });
    const n1 = payloads.find((p) => p.nodeId === "n1")!;
    const n2 = payloads.find((p) => p.nodeId === "n2")!;
    assert.equal(n1.objects[0]!.paletteItemId, "pi_castle_db"); // resolved
    assert.equal(n2.objects[0]!.paletteItemId, "pi_real"); // unresolved key left as-is
  });

  it("skips items with no nodeId and tolerates a missing/empty doc", () => {
    assert.deepEqual(splitDocForSave(null), []);
    assert.deepEqual(splitDocForSave({}), []);
    assert.deepEqual(splitDocForSave({ features: [{ _key: "x", kind: "pin" }] }), []);
  });
});

describe("applySavedIds", () => {
  it("maps returned {clientKey,id} back onto features/objects by _key", () => {
    const doc = {
      features: [{ _key: "ck-1", kind: "biome" }, { _key: "ck-2", kind: "river" }],
      objects: [{ _key: "ck-4", paletteItemId: "pi" }],
    };
    applySavedIds(doc, [
      { clientKey: "ck-1", id: "F1" },
      { clientKey: "ck-4", id: "O4" },
    ]);
    assert.equal((doc.features[0] as { id?: string }).id, "F1");
    assert.equal((doc.features[1] as { id?: string }).id, undefined); // not in saved set
    assert.equal((doc.objects[0] as { id?: string }).id, "O4");
  });

  it("is a no-op for junk input", () => {
    assert.doesNotThrow(() => applySavedIds(null, []));
    assert.doesNotThrow(() => applySavedIds({}, [{ clientKey: "a", id: "b" }]));
  });
});
