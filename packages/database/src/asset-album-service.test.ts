import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createAssetAlbumService } from "./asset-album-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("AssetAlbumService", () => {
  let db: PrismaClient;
  let databaseUrl: string;
  let worldId: string;
  let assetId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({
      name: "Album Test World",
      slug: "album-test",
    });
    worldId = world.id;
    const asset = await repo.createAsset({
      worldId,
      title: "Test Asset",
      type: "image",
      storageKey: `${worldId}/test.png`,
      mimeType: "image/png",
      size: 128,
      visibility: "dm_only",
    });
    assetId = asset.id;
  });

  after(async () => {
    await db.$disconnect();
  });

  it("creates albums and adds assets", async () => {
    const albums = createAssetAlbumService(db);
    const album = await albums.createAlbum({
      worldId,
      title: "Session Maps",
      description: "Battlemaps",
    });
    await albums.addAsset(album.id, assetId);

    const listed = await albums.listAlbumsByWorld(worldId);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.title, "Session Maps");

    const assetIds = await albums.listAssetIdsInAlbum(album.id);
    assert.deepEqual(assetIds, [assetId]);
  });
});
