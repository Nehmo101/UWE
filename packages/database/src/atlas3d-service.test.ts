import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createAtlas3DService, type Atlas3DService } from "./atlas3d-service";
import { createTestDatabaseUrl } from "./test-helpers";

let db: PrismaClient;
let atlas3d: Atlas3DService;

before(async () => {
  db = createPrismaClient(createTestDatabaseUrl());
  atlas3d = createAtlas3DService(db);
  await db.world.create({ data: { name: "Atlas3D Test World", slug: "atlas3d-test" } });
});

describe("createAtlas3DService", () => {
  it("lazily creates world + root globe node, idempotent", async () => {
    const first = await atlas3d.getOrCreateForWorld("atlas3d-test");
    assert.equal(first.rootNode.level, "globe");
    assert.equal(first.rootNode.parentId, null);
    const second = await atlas3d.getOrCreateForWorld("atlas3d-test");
    assert.equal(second.atlasWorld.id, first.atlasWorld.id);
    assert.equal(second.rootNode.id, first.rootNode.id);
    assert.equal(second.atlasWorld.stylePreset, "pergament");
  });

  it("drill-down creates the next level with unique slugs and wires the source feature", async () => {
    const { rootNode } = await atlas3d.getOrCreateForWorld("atlas3d-test");
    const [feature] = await atlas3d.saveFeatures(rootNode.id, [
      { kind: "region", geometry: { points: [[0, 0], [1, 0], [1, 1]] } },
    ]);
    const child = await atlas3d.createChildNode({
      parentId: rootNode.id,
      title: "Velthara",
      sourceFeatureId: feature.id,
      silhouette: { points: [[0, 0], [1, 0], [1, 1]] },
    });
    assert.equal(child.level, "continent");
    assert.equal(child.parentId, rootNode.id);
    const twin = await atlas3d.createChildNode({ parentId: rootNode.id, title: "Velthara" });
    assert.notEqual(twin.slug, child.slug);
    const linked = await db.atlas3DFeature.findUnique({ where: { id: feature.id } });
    assert.equal(linked?.childNodeId, child.id);
    // deepest level refuses further drill-down
    const landscape = await atlas3d.createChildNode({ parentId: child.id, title: "Aschmark" });
    const city = await atlas3d.createChildNode({ parentId: landscape.id, title: "Kargstein" });
    await assert.rejects(() => atlas3d.createChildNode({ parentId: city.id, title: "Zu tief" }));
  });

  it("node chain walks root-first for inheritance", async () => {
    const { rootNode } = await atlas3d.getOrCreateForWorld("atlas3d-test");
    const continent = await atlas3d.createChildNode({ parentId: rootNode.id, title: "Kettenland" });
    const landscape = await atlas3d.createChildNode({ parentId: continent.id, title: "Kettental" });
    const chain = await atlas3d.getNodeChain(landscape.id);
    assert.ok(chain);
    assert.deepEqual(
      chain.nodes.map((n) => n.level),
      ["globe", "continent", "landscape"],
    );
    assert.equal(chain.nodes[2].id, landscape.id);
  });

  it("terrain upsert stores carve ops and meta", async () => {
    const { rootNode } = await atlas3d.getOrCreateForWorld("atlas3d-test");
    const carveOps = [{ id: "b1", kind: "bite", center: [1, 0, 0], radius: 0.5 }];
    await atlas3d.saveTerrain(rootNode.id, { carveOps, meta: { resolution: 64 } });
    const updated = await atlas3d.saveTerrain(rootNode.id, {
      carveOps: [...carveOps, { id: "s1", kind: "split", normal: [1, 0, 0], gap: 0.4 }],
    });
    assert.equal((updated.carveOps as unknown[]).length, 2);
    const node = await atlas3d.getNode(rootNode.id);
    assert.equal((node?.terrain?.carveOps as unknown[]).length, 2);
  });

  it("objects replace-all keeps given ids and drops the rest", async () => {
    const { rootNode } = await atlas3d.getOrCreateForWorld("atlas3d-test");
    const [a] = await atlas3d.saveObjects(rootNode.id, [
      { assetKind: "worldroot", position: { lat: 10, lon: 20 }, tint: "paper" },
      { assetKind: "asteroid", position: { radius: 1.8, inclination: 0.3, phase: 0, speed: 0.2 } },
    ]);
    const kept = await atlas3d.saveObjects(rootNode.id, [
      { id: a.id, assetKind: "worldroot", position: { lat: 11, lon: 21 }, tint: "paper", scale: 2 },
    ]);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].id, a.id);
    assert.equal(kept[0].scale, 2);
    const node = await atlas3d.getNode(rootNode.id);
    assert.equal(node?.objects.length, 1);
  });

  it("bookmarks replace-all and viewer read returns everything", async () => {
    const { rootNode } = await atlas3d.getOrCreateForWorld("atlas3d-test");
    await atlas3d.saveBookmarks(rootNode.id, [
      { name: "Spalt-Blick", pose: { position: [0, 1, 3], target: [0, 0, 0], fov: 45 } },
    ]);
    const viewer = await atlas3d.getForViewer("atlas3d-test");
    assert.ok(viewer);
    const root = viewer.nodes.find((n) => n.id === rootNode.id);
    assert.equal(root?.bookmarks.length, 1);
    assert.ok((root?.objects.length ?? 0) >= 1);
  });

  it("saveFeatures with kinds restriction never touches region features", async () => {
    const { rootNode } = await atlas3d.getOrCreateForWorld("atlas3d-test");
    const region = await db.atlas3DFeature.create({
      data: { nodeId: rootNode.id, kind: "region", geometry: { points: [[0, 0, 1], [1, 0, 0], [0, 1, 0]] } },
    });
    await atlas3d.saveFeatures(
      rootNode.id,
      [{ kind: "river", geometry: { points: [{ x: 0, z: 0 }, { x: 1, z: 1 }] } }],
      { kinds: ["river", "road", "label"] },
    );
    const regionsBefore = await db.atlas3DFeature.count({ where: { nodeId: rootNode.id, kind: "region" } });
    // replace-all within the restricted kinds: river replaced, regions untouched
    await atlas3d.saveFeatures(rootNode.id, [{ kind: "road", geometry: { points: [{ x: 0, z: 0 }, { x: -1, z: 0 }] } }], {
      kinds: ["river", "road", "label"],
    });
    const after = await db.atlas3DFeature.findMany({ where: { nodeId: rootNode.id } });
    assert.equal(after.filter((f) => f.kind === "region").length, regionsBefore, "regions untouched");
    assert.equal(after.filter((f) => f.kind === "river").length, 0, "river replaced away");
    assert.equal(after.filter((f) => f.kind === "road").length, 1, "road saved");
    assert.ok(await db.atlas3DFeature.findUnique({ where: { id: region.id } }), "region survives editor saves");
  });

  it("subtree delete removes descendants leaf-first", async () => {
    const { rootNode } = await atlas3d.getOrCreateForWorld("atlas3d-test");
    const cont = await atlas3d.createChildNode({ parentId: rootNode.id, title: "Löschland" });
    const land = await atlas3d.createChildNode({ parentId: cont.id, title: "Löschtal" });
    await atlas3d.saveTerrain(land.id, { meta: { resolution: 32 } });
    const removed = await atlas3d.deleteNodeSubtree(cont.id);
    assert.equal(removed, 2);
    assert.equal(await db.atlas3DNode.findUnique({ where: { id: land.id } }), null);
    assert.ok(await db.atlas3DNode.findUnique({ where: { id: rootNode.id } }));
  });

  it("deleteNodeWithCleanup removes the subtree and the dangling parent region feature", async () => {
    const { rootNode } = await atlas3d.getOrCreateForWorld("atlas3d-test");
    const region = await db.atlas3DFeature.create({
      data: { nodeId: rootNode.id, kind: "region", geometry: { points: [[0, 0, 1], [1, 0, 0], [0, 1, 0]] } },
    });
    const cont = await atlas3d.createChildNode({ parentId: rootNode.id, title: "Aufräumland", sourceFeatureId: region.id });
    const land = await atlas3d.createChildNode({ parentId: cont.id, title: "Aufräumtal" });
    const { deletedNodes } = await atlas3d.deleteNodeWithCleanup(cont.id);
    assert.equal(deletedNodes, 2);
    assert.equal(await db.atlas3DNode.findUnique({ where: { id: cont.id } }), null);
    assert.equal(await db.atlas3DNode.findUnique({ where: { id: land.id } }), null);
    assert.equal(await db.atlas3DFeature.findUnique({ where: { id: region.id } }), null, "parent region feature cleaned up");
    assert.ok(await db.atlas3DNode.findUnique({ where: { id: rootNode.id } }));
  });

  it("deleteNodeWithCleanup rejects the root node", async () => {
    const { rootNode } = await atlas3d.getOrCreateForWorld("atlas3d-test");
    await assert.rejects(() => atlas3d.deleteNodeWithCleanup(rootNode.id), /root/);
  });

  it("resetNode edits-only clears content but keeps regions, children and seed", async () => {
    const { rootNode } = await atlas3d.getOrCreateForWorld("atlas3d-test");
    const target = await atlas3d.createChildNode({ parentId: rootNode.id, title: "Resetland" });
    const region = await db.atlas3DFeature.create({
      data: { nodeId: target.id, kind: "region", geometry: { points: [[0, 0], [1, 0], [1, 1]] } },
    });
    const child = await atlas3d.createChildNode({ parentId: target.id, title: "Resettal", sourceFeatureId: region.id });
    await atlas3d.saveTerrain(target.id, { carveOps: [{ id: "b", kind: "bite", center: [1, 0, 0], radius: 0.4 }] });
    await atlas3d.saveObjects(target.id, [{ assetKind: "tree", position: { x: 0, z: 0 } }]);
    await atlas3d.saveBookmarks(target.id, [{ name: "Blick", pose: { theta: 1 } }]);
    await atlas3d.saveFeatures(target.id, [{ kind: "river", geometry: { points: [] } }], { kinds: ["river", "road", "label"] });
    await atlas3d.updateNode(target.id, { environment: { timeOfDay: "night" } });

    const { deletedNodes } = await atlas3d.resetNode(target.id, { includeSubtree: false });
    assert.equal(deletedNodes, 0);
    const after = await atlas3d.getNode(target.id);
    assert.ok(after);
    assert.equal(after.terrain, null, "terrain cleared");
    assert.equal(after.objects.length, 0, "objects cleared");
    assert.equal(after.bookmarks.length, 0, "bookmarks cleared");
    assert.deepEqual(after.features.map((f) => f.kind), ["region"], "only the region feature survives");
    assert.equal(after.environment, null, "environment override cleared");
    assert.equal(after.seed, target.seed, "seed unchanged");
    assert.ok(await db.atlas3DNode.findUnique({ where: { id: child.id } }), "child level survives");
  });

  it("resetNode full deletes region features and child subtrees but keeps the node", async () => {
    const { rootNode } = await atlas3d.getOrCreateForWorld("atlas3d-test");
    const target = await atlas3d.createChildNode({ parentId: rootNode.id, title: "Vollresetland" });
    const region = await db.atlas3DFeature.create({
      data: { nodeId: target.id, kind: "region", geometry: { points: [[0, 0], [1, 0], [1, 1]] } },
    });
    const child = await atlas3d.createChildNode({ parentId: target.id, title: "Vollresettal", sourceFeatureId: region.id });
    const grandchild = await atlas3d.createChildNode({ parentId: child.id, title: "Vollresetstadt" });

    const { deletedNodes } = await atlas3d.resetNode(target.id, { includeSubtree: true });
    assert.equal(deletedNodes, 2);
    const after = await atlas3d.getNode(target.id);
    assert.ok(after, "node itself survives the full reset");
    assert.equal(after.features.length, 0, "region features deleted");
    assert.equal(await db.atlas3DNode.findUnique({ where: { id: child.id } }), null);
    assert.equal(await db.atlas3DNode.findUnique({ where: { id: grandchild.id } }), null);
  });

  it("deleteFeature removes only the addressed feature and keeps the linked child", async () => {
    const { rootNode } = await atlas3d.getOrCreateForWorld("atlas3d-test");
    const region = await db.atlas3DFeature.create({
      data: { nodeId: rootNode.id, kind: "region", geometry: { points: [[0, 0, 1], [1, 0, 0], [0, 1, 0]] } },
    });
    const child = await atlas3d.createChildNode({ parentId: rootNode.id, title: "Markerland", sourceFeatureId: region.id });
    await atlas3d.deleteFeature(rootNode.id, region.id);
    assert.equal(await db.atlas3DFeature.findUnique({ where: { id: region.id } }), null);
    assert.ok(await db.atlas3DNode.findUnique({ where: { id: child.id } }), "linked child survives");
    await assert.rejects(() => atlas3d.deleteFeature(child.id, region.id), /not found/);
  });
});
