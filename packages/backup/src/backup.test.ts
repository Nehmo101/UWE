import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  buildStorageKey,
  ensureUploadDirectory,
  resolveAssetFilePath,
} from "@uwe/assets";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { createPrismaClient, createUweRepository } from "@uwe/database/server";
import {
  createBackupBundle,
  executeRestore,
  exportBackupZip,
  findSecretIssuesInJson,
  loadBackupFromBuffer,
  previewRestoreOnly,
  readBackupZip,
  writeBackupZip,
} from "./index";

describe("UWE backup and restore", () => {
  let databaseUrl: string;
  let uploadsRoot: string;
  let backupsDir: string;
  let worldSlug: string;
  let worldId: string;
  let assetStorageKey: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    uploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-uploads-"));
    backupsDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-backups-"));
    process.env.UWE_UPLOADS_ROOT = uploadsRoot;

    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({
      name: "Backup Test World",
      slug: "backup-test",
      description: "Backup integration tests",
    });
    worldSlug = world.slug;
    worldId = world.id;

    const campaign = await repo.createCampaign({
      worldId: world.id,
      name: "Test Campaign",
      slug: "test-campaign",
    });

    const page = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Backup Page",
      slug: "backup-page",
      type: "lore",
      visibility: "dm_only",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          content: "Secret GM note",
        },
      ],
    });

    assetStorageKey = buildStorageKey(world.id, "backup-map.png");
    ensureUploadDirectory(world.id, uploadsRoot);
    fs.writeFileSync(
      resolveAssetFilePath(assetStorageKey, uploadsRoot),
      Buffer.from("png-bytes"),
    );

    await repo.createAsset({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Backup Map",
      type: "map",
      storageKey: assetStorageKey,
      mimeType: "image/png",
      size: 8,
      visibility: "dm_only",
    });

    await repo.linkAssetToPage(
      (
        await repo.listAssetsByWorld(worldSlug)
      ).find((asset) => asset.title === "Backup Map")!.id,
      page.id,
    );

    const db = createPrismaClient(databaseUrl);
    await db.user.create({
      data: {
        displayName: "Secret User",
        email: "secret@example.com",
        passwordHash: "super-secret-hash",
        role: "dm",
      },
    });
    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
    fs.rmSync(uploadsRoot, { recursive: true, force: true });
    fs.rmSync(backupsDir, { recursive: true, force: true });
    delete process.env.UWE_UPLOADS_ROOT;
  });

  it("exports a world backup with expected data", async () => {
    const bundle = await createBackupBundle(databaseUrl, {
      type: "world",
      worldSlug,
    });

    assert.equal(bundle.manifest.type, "world");
    assert.equal(bundle.manifest.worldSlug, worldSlug);
    assert.equal(bundle.data.worlds.length, 1);
    assert.equal(bundle.data.campaigns.length, 1);
    assert.ok(bundle.data.pages.some((page) => page.slug === "backup-page"));
    assert.ok(bundle.data.assets.some((asset) => asset.storageKey === assetStorageKey));
    assert.equal(bundle.data.users.length, 0);
  });

  it("does not export secrets", async () => {
    const bundle = await createBackupBundle(databaseUrl, { type: "full" });
    const json = JSON.stringify(bundle.data);
    const issues = findSecretIssuesInJson(json);

    assert.equal(issues.length, 0);
    assert.ok(!json.includes("super-secret-hash"));
    assert.ok(!json.toLowerCase().includes("passwordhash"));
  });

  it("writes and reads zip backups including assets", async () => {
    const { bundle, outputPath } = await exportBackupZip(databaseUrl, {
      type: "world",
      worldSlug,
      uploadsRoot,
      outputDir: backupsDir,
    });

    assert.ok(fs.existsSync(outputPath));
    assert.ok(outputPath.endsWith(".zip"));
    assert.ok(bundle.manifest.assetFiles.length >= 1);

    const loaded = readBackupZip(outputPath);
    assert.equal(loaded.data.pages.length, bundle.data.pages.length);
    assert.equal(loaded.manifest.stats.assets, bundle.manifest.stats.assets);
  });

  it("restore preview does not modify data", async () => {
    const bundle = await createBackupBundle(databaseUrl, {
      type: "world",
      worldSlug,
    });

    const db = createPrismaClient(databaseUrl);
    const beforeWorlds = await db.world.count();
    const beforePages = await db.page.count();

    const preview = await previewRestoreOnly(db, bundle);

    const afterWorlds = await db.world.count();
    const afterPages = await db.page.count();
    await db.$disconnect();

    assert.equal(beforeWorlds, afterWorlds);
    assert.equal(beforePages, afterPages);
    assert.ok(preview.items.length > 0);
    assert.ok(
      preview.items.some(
        (item) => item.entityType === "world" && (item.status === "duplicate" || item.status === "conflict"),
      ),
    );
  });

  it("restores data into a fresh database", async () => {
    const sourceBundle = await createBackupBundle(databaseUrl, {
      type: "world",
      worldSlug,
    });

    const zipPath = path.join(backupsDir, "roundtrip.zip");
    writeBackupZip(sourceBundle, zipPath, uploadsRoot);
    const zipBuffer = fs.readFileSync(zipPath);

    const targetDbUrl = createTestDatabaseUrl();
    const targetUploads = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-restore-uploads-"));
    process.env.UWE_UPLOADS_ROOT = targetUploads;

    const targetDb = createPrismaClient(targetDbUrl);
    const bundle = loadBackupFromBuffer(zipBuffer, "roundtrip.zip");

    const preview = await previewRestoreOnly(targetDb, bundle);
    assert.equal(preview.stats.new, preview.items.filter((item) => item.status === "new").length);

    const result = await executeRestore(targetDb, bundle, {
      confirmed: true,
      autoResolveSlugConflicts: true,
    }, zipBuffer, targetUploads);

    assert.ok(result.created > 0);
    assert.equal(result.errors.length, 0);

    const restoredWorld = await targetDb.world.findUnique({ where: { slug: worldSlug } });
    assert.ok(restoredWorld);
    assert.equal(await targetDb.page.count(), sourceBundle.data.pages.length);
    assert.equal(await targetDb.asset.count(), sourceBundle.data.assets.length);

    const restoredAsset = await targetDb.asset.findFirst({
      where: { worldId: restoredWorld!.id },
    });
    assert.ok(restoredAsset);
    assert.ok(fs.existsSync(resolveAssetFilePath(restoredAsset!.storageKey, targetUploads)));

    await targetDb.$disconnect();
    fs.rmSync(targetUploads, { recursive: true, force: true });
  });

  it("exports campaign-scoped backups", async () => {
    const bundle = await createBackupBundle(databaseUrl, {
      type: "campaign",
      worldSlug,
      campaignSlug: "test-campaign",
    });

    assert.equal(bundle.manifest.type, "campaign");
    assert.equal(bundle.data.campaigns.length, 1);
    assert.equal(bundle.data.campaigns[0]?.slug, "test-campaign");
    assert.ok(bundle.data.pages.every((page) => page.campaignId === bundle.data.campaigns[0]?.id));
  });
});
