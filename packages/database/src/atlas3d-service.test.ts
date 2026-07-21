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
});
