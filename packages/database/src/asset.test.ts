import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import {
  buildStorageKey,
  ensureUploadDirectory,
  resolveAssetFilePath,
  resolveUploadsRoot,
} from "@uwe/assets";
import { createAuthService } from "./auth";
import { seedAuthUsers } from "./auth-seed";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

describe("UWE asset system", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let playerUserId: string;
  let pageId: string;
  let dmOnlyAssetId: string;
  let playerAssetId: string;
  let uploadsRoot: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    uploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-uploads-"));
    process.env.UWE_UPLOADS_ROOT = uploadsRoot;

    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const auth = createAuthService(db);

    const world = await repo.createWorld({
      name: "Asset Test World",
      slug: "asset-test",
      description: "Asset integration tests",
    });
    worldSlug = world.slug;

    const users = await seedAuthUsers(auth, repo, world.id);
    playerUserId = users.players[0]!.id;

    const page = await repo.createPage({
      worldId: world.id,
      title: "Linked Page",
      slug: "linked-page",
      type: "handout",
      visibility: "player_visible",
    });
    pageId = page.id;

    const storageKey = buildStorageKey(world.id, "secret-map.png");
    ensureUploadDirectory(world.id, uploadsRoot);
    fs.writeFileSync(resolveAssetFilePath(storageKey, uploadsRoot), "dm-only-bytes");

    const dmAsset = await repo.createAsset({
      worldId: world.id,
      title: "Secret Map",
      type: "map",
      storageKey,
      mimeType: "image/png",
      size: 14,
      visibility: "dm_only",
    });
    dmOnlyAssetId = dmAsset.id;

    const playerStorageKey = buildStorageKey(world.id, "player-handout.pdf");
    fs.writeFileSync(resolveAssetFilePath(playerStorageKey, uploadsRoot), "player-bytes");

    const playerAsset = await repo.createAsset({
      worldId: world.id,
      title: "Player Handout",
      type: "handout",
      storageKey: playerStorageKey,
      mimeType: "application/pdf",
      size: 12,
      visibility: "player_visible",
    });
    playerAssetId = playerAsset.id;

    await repo.linkAssetToPage(playerAsset.id, pageId);

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
    fs.rmSync(uploadsRoot, { recursive: true, force: true });
    delete process.env.UWE_UPLOADS_ROOT;
  });

  it("lets DM see all assets", async () => {
    const repo = createUweRepository(databaseUrl);
    const assets = await repo.listAssetsForContext(worldSlug, "dm");
    const ids = assets.map((asset) => asset.id);

    assert.ok(ids.includes(dmOnlyAssetId));
    assert.ok(ids.includes(playerAssetId));
  });

  it("lets player see only allowed assets via portal context", async () => {
    const repo = createUweRepository(databaseUrl);
    const assets = await repo.listAssetsForContext(worldSlug, "portal");
    const ids = assets.map((asset) => asset.id);

    assert.ok(!ids.includes(dmOnlyAssetId));
    assert.ok(ids.includes(playerAssetId));
  });

  it("does not deliver dm_only asset through getAssetForContext", async () => {
    const repo = createUweRepository(databaseUrl);
    const asset = await repo.getAssetForContext(dmOnlyAssetId, "portal");
    assert.equal(asset, null);
  });

  it("links asset to page", async () => {
    const repo = createUweRepository(databaseUrl);
    const pageAssets = await repo.listAssetsForPage(pageId);
    assert.equal(pageAssets.length, 1);
    assert.equal(pageAssets[0]!.id, playerAssetId);
  });

  it("filters assets for authenticated player viewer", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    try {
      const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
      assert.ok(ctx);

      const assets = await auth.listAssetsForViewer(worldSlug, ctx);
      const ids = assets.map((asset) => asset.id);

      assert.ok(!ids.includes(dmOnlyAssetId));
      assert.ok(ids.includes(playerAssetId));

      const blocked = await auth.getAssetForViewer(worldSlug, dmOnlyAssetId, ctx);
      assert.equal(blocked, null);

      const allowed = await auth.getAssetForViewer(worldSlug, playerAssetId, ctx);
      assert.ok(allowed);
    } finally {
      await db.$disconnect();
    }
  });

  it("stores uploads outside git-tracked paths", () => {
    const repoRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../..",
    );
    const uploadsDir = resolveUploadsRoot(uploadsRoot);
    assert.ok(!uploadsDir.startsWith(path.join(repoRoot, ".git")));
    assert.ok(uploadsDir.includes("uwe-uploads"));
  });
});
