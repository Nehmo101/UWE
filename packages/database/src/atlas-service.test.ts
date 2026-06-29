import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createAtlasService, isAtlasEntityAccessible } from "./atlas-service";
import { createTestDatabaseUrl } from "./test-helpers";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function seedWorld(db: PrismaClient, slug = "atlas-test") {
  return db.world.create({
    data: { name: "Atlas Test World", slug },
  });
}

async function seedPaletteItem(db: PrismaClient, worldId?: string) {
  return db.atlasPaletteItem.create({
    data: {
      worldId: worldId ?? null,
      name: "Forest",
      kind: "terrain",
      source: "builtin",
      reviewStatus: "approved",
    },
  });
}

// ---------------------------------------------------------------------------
// isAtlasEntityAccessible unit tests (pure function, no DB)
// ---------------------------------------------------------------------------

describe("isAtlasEntityAccessible", () => {
  it("allows dm context for any visibility", () => {
    assert.equal(isAtlasEntityAccessible({ visibility: "dm_only" }, "dm"), true);
    assert.equal(isAtlasEntityAccessible({ visibility: "private" }, "dm"), true);
    assert.equal(isAtlasEntityAccessible({ visibility: "player_visible" }, "dm"), true);
    assert.equal(isAtlasEntityAccessible({ visibility: "public" }, "dm"), true);
  });

  it("blocks dm_only and private from portal context", () => {
    assert.equal(isAtlasEntityAccessible({ visibility: "dm_only" }, "portal"), false);
    assert.equal(isAtlasEntityAccessible({ visibility: "private" }, "portal"), false);
    assert.equal(isAtlasEntityAccessible({ visibility: "archived" }, "portal"), false);
  });

  it("allows player_visible and public for portal context", () => {
    assert.equal(isAtlasEntityAccessible({ visibility: "player_visible" }, "portal"), true);
    assert.equal(isAtlasEntityAccessible({ visibility: "public" }, "portal"), true);
  });

  it("blocks dm_only and private from preview context", () => {
    assert.equal(isAtlasEntityAccessible({ visibility: "dm_only" }, "preview"), false);
    assert.equal(isAtlasEntityAccessible({ visibility: "private" }, "preview"), false);
  });

  it("allows player_visible and public for preview context", () => {
    assert.equal(isAtlasEntityAccessible({ visibility: "player_visible" }, "preview"), true);
    assert.equal(isAtlasEntityAccessible({ visibility: "public" }, "preview"), true);
  });
});

// ---------------------------------------------------------------------------
// AtlasMap — getOrCreateAtlasForWorld
// ---------------------------------------------------------------------------

describe("AtlasService — getOrCreateAtlasForWorld", () => {
  let db: PrismaClient;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("creates a new atlas for a world that has none", async () => {
    const world = await seedWorld(db, "atlas-create-test");
    const service = createAtlasService(db);

    const atlas = await service.getOrCreateAtlasForWorld(world.id);
    assert.equal(atlas.worldId, world.id);
    assert.equal(atlas.title, "Atlas");
    assert.equal(atlas.stylePreset, "tolkien-ink");
    assert.equal(atlas.visibility, "dm_only");
  });

  it("returns existing atlas on repeated calls (idempotent)", async () => {
    const world = await seedWorld(db, "atlas-idempotent-test");
    const service = createAtlasService(db);

    const first = await service.getOrCreateAtlasForWorld(world.id);
    const second = await service.getOrCreateAtlasForWorld(world.id);
    assert.equal(first.id, second.id);
  });

  it("updates atlas map fields", async () => {
    const world = await seedWorld(db, "atlas-update-test");
    const service = createAtlasService(db);

    const atlas = await service.getOrCreateAtlasForWorld(world.id);
    const updated = await service.updateAtlasMap(atlas.id, {
      title: "Middle-Earth Atlas",
      stylePreset: "satellite",
      visibility: "player_visible",
    });
    assert.equal(updated.title, "Middle-Earth Atlas");
    assert.equal(updated.stylePreset, "satellite");
    assert.equal(updated.visibility, "player_visible");
  });
});

// ---------------------------------------------------------------------------
// AtlasNode CRUD
// ---------------------------------------------------------------------------

describe("AtlasService — node CRUD", () => {
  let db: PrismaClient;
  let mapId: string;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    const world = await seedWorld(db, "atlas-node-crud");
    const atlas = await db.atlasMap.create({
      data: { worldId: world.id },
    });
    mapId = atlas.id;
  });

  it("creates a globe-level node with dm_only visibility", async () => {
    const service = createAtlasService(db);
    const node = await service.createNode({
      mapId,
      level: "globe",
      title: "Terra",
      visibility: "dm_only",
    });
    assert.equal(node.mapId, mapId);
    assert.equal(node.level, "globe");
    assert.equal(node.title, "Terra");
    assert.equal(node.visibility, "dm_only");
  });

  it("creates a node and retrieves it by id", async () => {
    const service = createAtlasService(db);
    const node = await service.createNode({
      mapId,
      level: "continent",
      title: "Northern Lands",
      visibility: "player_visible",
    });

    const retrieved = await service.getNode(node.id);
    assert.ok(retrieved);
    assert.equal(retrieved.id, node.id);
    assert.equal(retrieved.title, "Northern Lands");
  });

  it("updates a node", async () => {
    const service = createAtlasService(db);
    const node = await service.createNode({
      mapId,
      level: "city",
      title: "Old Town",
      visibility: "dm_only",
    });

    const updated = await service.updateNode(node.id, {
      title: "New Town",
      visibility: "player_visible",
    });
    assert.equal(updated.title, "New Town");
    assert.equal(updated.visibility, "player_visible");
  });

  it("lists all nodes for a map in sort order", async () => {
    const world2 = await seedWorld(db, "atlas-list-nodes");
    const atlas2 = await db.atlasMap.create({ data: { worldId: world2.id } });
    const service = createAtlasService(db);

    await service.createNode({ mapId: atlas2.id, level: "continent", title: "B", sortOrder: 2 });
    await service.createNode({ mapId: atlas2.id, level: "continent", title: "A", sortOrder: 1 });

    const nodes = await service.listNodesForMap(atlas2.id);
    assert.equal(nodes.length, 2);
    assert.equal(nodes[0]!.title, "A");
    assert.equal(nodes[1]!.title, "B");
  });

  it("deletes a node", async () => {
    const service = createAtlasService(db);
    const node = await service.createNode({
      mapId,
      level: "landscape",
      title: "Temp Node",
    });
    await service.deleteNode(node.id);
    const after = await service.getNode(node.id);
    assert.equal(after, null);
  });
});

// ---------------------------------------------------------------------------
// AtlasFeature CRUD
// ---------------------------------------------------------------------------

describe("AtlasService — feature CRUD", () => {
  let db: PrismaClient;
  let nodeId: string;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    const world = await seedWorld(db, "atlas-feature-crud");
    const atlas = await db.atlasMap.create({ data: { worldId: world.id } });
    const node = await db.atlasNode.create({
      data: { mapId: atlas.id, level: "continent", title: "Root Node" },
    });
    nodeId = node.id;
  });

  it("creates a feature with geometry", async () => {
    const service = createAtlasService(db);
    const feature = await service.createFeature({
      nodeId,
      kind: "region",
      geometry: { type: "Polygon", coordinates: [] },
      visibility: "dm_only",
    });
    assert.equal(feature.nodeId, nodeId);
    assert.equal(feature.kind, "region");
    assert.equal(feature.visibility, "dm_only");
  });

  it("lists features for node ordered by layer", async () => {
    const service = createAtlasService(db);
    await service.createFeature({ nodeId, kind: "river", geometry: {}, layer: 2 });
    await service.createFeature({ nodeId, kind: "biome", geometry: {}, layer: 0 });

    const features = await service.listFeaturesForNode(nodeId);
    assert.ok(features.length >= 2);
    // biome (layer 0) should come before river (layer 2)
    const layers = features.map((f) => f.layer);
    for (let i = 1; i < layers.length; i++) {
      assert.ok(layers[i]! >= layers[i - 1]!);
    }
  });

  it("updates feature visibility", async () => {
    const service = createAtlasService(db);
    const feature = await service.createFeature({
      nodeId,
      kind: "label",
      geometry: {},
      visibility: "dm_only",
    });
    const updated = await service.updateFeature(feature.id, { visibility: "player_visible" });
    assert.equal(updated.visibility, "player_visible");
  });

  it("deletes a feature", async () => {
    const service = createAtlasService(db);
    const feature = await service.createFeature({ nodeId, kind: "pin", geometry: {} });
    await service.deleteFeature(feature.id);
    const after = await service.getFeature(feature.id);
    assert.equal(after, null);
  });
});

// ---------------------------------------------------------------------------
// AtlasObject CRUD
// ---------------------------------------------------------------------------

describe("AtlasService — object CRUD", () => {
  let db: PrismaClient;
  let nodeId: string;
  let paletteItemId: string;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    const world = await seedWorld(db, "atlas-object-crud");
    const atlas = await db.atlasMap.create({ data: { worldId: world.id } });
    const node = await db.atlasNode.create({
      data: { mapId: atlas.id, level: "city", title: "City Node" },
    });
    nodeId = node.id;
    const item = await seedPaletteItem(db, world.id);
    paletteItemId = item.id;
  });

  it("creates an object placed at coordinates", async () => {
    const service = createAtlasService(db);
    const obj = await service.createObject({
      nodeId,
      paletteItemId,
      x: 10,
      y: 20,
      visibility: "dm_only",
    });
    assert.equal(obj.x, 10);
    assert.equal(obj.y, 20);
    assert.equal(obj.visibility, "dm_only");
  });

  it("updates object position and visibility", async () => {
    const service = createAtlasService(db);
    const obj = await service.createObject({ nodeId, paletteItemId, x: 0, y: 0 });
    const updated = await service.updateObject(obj.id, {
      x: 99,
      y: 77,
      visibility: "player_visible",
    });
    assert.equal(updated.x, 99);
    assert.equal(updated.y, 77);
    assert.equal(updated.visibility, "player_visible");
  });

  it("deletes an object", async () => {
    const service = createAtlasService(db);
    const obj = await service.createObject({ nodeId, paletteItemId, x: 1, y: 2 });
    await service.deleteObject(obj.id);
    const after = await service.getObject(obj.id);
    assert.equal(after, null);
  });
});

// ---------------------------------------------------------------------------
// AtlasPaletteItem
// ---------------------------------------------------------------------------

describe("AtlasService — palette items", () => {
  let db: PrismaClient;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("creates and lists palette items (global + world-scoped)", async () => {
    const world = await seedWorld(db, "atlas-palette-test");
    const service = createAtlasService(db);

    await service.createPaletteItem({ name: "Global Castle", kind: "building", source: "builtin" });
    await service.createPaletteItem({ worldId: world.id, name: "World Tower", kind: "building", source: "upload" });

    const items = await service.listPaletteItems(world.id);
    const names = items.map((i) => i.name);
    assert.ok(names.includes("Global Castle"));
    assert.ok(names.includes("World Tower"));
  });

  it("approves a pending palette item", async () => {
    const service = createAtlasService(db);
    const item = await service.createPaletteItem({
      name: "AI Tree",
      kind: "vegetation",
      source: "ai",
      reviewStatus: "pending",
    });
    assert.equal(item.reviewStatus, "pending");

    const approved = await service.approvePaletteItem(item.id);
    assert.equal(approved.reviewStatus, "approved");
  });
});

// ---------------------------------------------------------------------------
// Portal context filtering — getAtlasForContext
// ---------------------------------------------------------------------------

describe("AtlasService — getAtlasForContext visibility filtering", () => {
  let db: PrismaClient;
  let worldSlug: string;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    worldSlug = "atlas-portal-filter";
    const world = await db.world.create({ data: { name: "Portal Filter World", slug: worldSlug } });
    const atlas = await db.atlasMap.create({
      data: { worldId: world.id, visibility: "player_visible" },
    });
    // Node visible to portal
    const visibleNode = await db.atlasNode.create({
      data: { mapId: atlas.id, level: "continent", title: "Visible Continent", visibility: "player_visible" },
    });
    // Node hidden from portal (dm_only)
    await db.atlasNode.create({
      data: { mapId: atlas.id, level: "continent", title: "DM Only Continent", visibility: "dm_only" },
    });
    // Feature on visible node — dm_only (should be hidden from portal)
    await db.atlasFeature.create({
      data: { nodeId: visibleNode.id, kind: "region", geometry: {}, visibility: "dm_only" },
    });
    // Feature on visible node — player_visible (should be shown)
    await db.atlasFeature.create({
      data: { nodeId: visibleNode.id, kind: "river", geometry: {}, visibility: "player_visible" },
    });
  });

  it("DM context sees all nodes and features", async () => {
    const service = createAtlasService(db);
    const result = await service.getAtlasForContext(worldSlug, "dm");

    assert.ok(result);
    assert.equal(result.nodes.length, 2);
    assert.equal(result.features.length, 2);
  });

  it("portal context hides dm_only atlas map", async () => {
    const service = createAtlasService(db);
    // Atlas has visibility player_visible so it should pass; test with dm_only map
    const world2 = await db.world.create({ data: { name: "DM Atlas World", slug: "atlas-dm-only-map" } });
    await db.atlasMap.create({ data: { worldId: world2.id, visibility: "dm_only" } });

    const result = await service.getAtlasForContext("atlas-dm-only-map", "portal");
    assert.equal(result, null);
  });

  it("portal context shows only player_visible nodes", async () => {
    const service = createAtlasService(db);
    const result = await service.getAtlasForContext(worldSlug, "portal");

    assert.ok(result);
    assert.equal(result.nodes.length, 1);
    assert.equal(result.nodes[0]!.title, "Visible Continent");
  });

  it("portal context shows only player_visible features", async () => {
    const service = createAtlasService(db);
    const result = await service.getAtlasForContext(worldSlug, "portal");

    assert.ok(result);
    assert.equal(result.features.length, 1);
    assert.equal(result.features[0]!.kind, "river");
  });

  it("returns null for non-existent world", async () => {
    const service = createAtlasService(db);
    const result = await service.getAtlasForContext("no-such-world", "portal");
    assert.equal(result, null);
  });

  it("returns null when world has no atlas", async () => {
    const world = await db.world.create({ data: { name: "Empty World", slug: "atlas-empty-world" } });
    const service = createAtlasService(db);
    const result = await service.getAtlasForContext(world.slug, "portal");
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// linkNodeToPage helper
// ---------------------------------------------------------------------------

describe("AtlasService — linkNodeToPage", () => {
  let db: PrismaClient;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("links a node to a wiki page", async () => {
    const world = await seedWorld(db, "atlas-link-node");
    const page = await db.page.create({
      data: {
        worldId: world.id,
        title: "Location Page",
        slug: "location-page",
        type: "location",
        visibility: "player_visible",
        publishStatus: "published",
      },
    });
    const atlas = await db.atlasMap.create({ data: { worldId: world.id } });
    const node = await db.atlasNode.create({
      data: { mapId: atlas.id, level: "city", title: "City" },
    });

    const service = createAtlasService(db);
    const linked = await service.linkNodeToPage(node.id, page.id);
    assert.equal(linked.pageId, page.id);
  });
});
