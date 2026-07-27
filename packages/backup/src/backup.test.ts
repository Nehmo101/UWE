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
import {
  createTestBrainClient,
  createTestBrainDatabaseUrl,
  createTestFamilyClient,
  createTestFamilyDatabaseUrl,
  createTestDatabaseUrl,
} from "@uwe/database/test-helpers";
import { createBrainPrismaClient } from "@uwe/database/brain-client";
import { createFamilyPrismaClient } from "@uwe/database/family-client";
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
  let assetStorageKey: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    uploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-uploads-"));
    backupsDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-backups-"));
    process.env.UWE_UPLOADS_ROOT = uploadsRoot;
    // createBackupBundle reads the owner-private Brain store via
    // createBrainPrismaClient() (no arg → BRAIN_DATABASE_URL). Point it at an
    // isolated, migrated Brain DB so the source Brain data lives there too.
    process.env.BRAIN_DATABASE_URL = createTestBrainDatabaseUrl();
    // Dasselbe für die geteilte Family-DB, die createBackupBundle über
    // FAMILY_DATABASE_URL liest.
    process.env.FAMILY_DATABASE_URL = createTestFamilyDatabaseUrl();

    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({
      name: "Backup Test World",
      slug: "backup-test",
      description: "Backup integration tests",
    });
    worldSlug = world.slug;

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
    });

    await repo.linkAssetToPage(
      (
        await repo.listAssetsByWorld(worldSlug)
      ).find((asset) => asset.title === "Backup Map")!.id,
      page.id,
    );

    const db = createPrismaClient(databaseUrl);
    const player = await db.user.create({
      data: {
        displayName: "Backup Player",
        email: "player-backup@uwe.local",
        passwordHash: "hashed-not-exported",
        portalAccess: true,
        studioAccess: false,
      },
    });
    await db.worldMembership.create({
      data: {
        userId: player.id,
        worldId: world.id,
        characterName: "Test PC",
      },
    });
    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
    fs.rmSync(uploadsRoot, { recursive: true, force: true });
    fs.rmSync(backupsDir, { recursive: true, force: true });
    delete process.env.UWE_UPLOADS_ROOT;
    delete process.env.BRAIN_DATABASE_URL;
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
    assert.equal(bundle.data.users.length, 1);
    assert.equal(bundle.data.worldMemberships.length, 1);
    assert.equal(bundle.data.users[0]?.email, "player-backup@uwe.local");
  });

  it("does not export secrets", async () => {
    const bundle = await createBackupBundle(databaseUrl, { type: "full" });
    const json = JSON.stringify(bundle.data);
    const issues = findSecretIssuesInJson(json);

    assert.equal(issues.length, 0);
    assert.ok(!json.includes("super-secret-hash"));
    assert.ok(!json.includes("hashed-not-exported"));
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
    const targetBrainDb = createTestBrainClient();
    const targetFamilyDb = createTestFamilyClient();
    const bundle = loadBackupFromBuffer(zipBuffer, "roundtrip.zip");

    const preview = await previewRestoreOnly(targetDb, bundle);
    assert.equal(preview.stats.new, preview.items.filter((item) => item.status === "new").length);

    const result = await executeRestore(targetDb, targetBrainDb, targetFamilyDb, bundle, {
      confirmed: true,
      autoResolveSlugConflicts: true,
    }, zipBuffer, targetUploads);

    assert.ok(result.created > 0);
    assert.equal(result.errors.length, 0);

    const restoredWorld = await targetDb.world.findUnique({ where: { slug: worldSlug } });
    assert.ok(restoredWorld);
    assert.equal(await targetDb.page.count(), sourceBundle.data.pages.length);
    assert.equal(await targetDb.asset.count(), sourceBundle.data.assets.length);
    assert.equal(await targetDb.worldMembership.count(), sourceBundle.data.worldMemberships.length);

    const restoredMembership = await targetDb.worldMembership.findFirst({
      where: { worldId: restoredWorld!.id },
      include: { user: { select: { email: true } } },
    });
    assert.ok(restoredMembership);
    assert.equal(restoredMembership.user.email, "player-backup@uwe.local");
    assert.ok(result.usersNeedingPassword.includes("player-backup@uwe.local"));

    const restoredUser = await targetDb.user.findUnique({
      where: { email: "player-backup@uwe.local" },
    });
    assert.ok(restoredUser);
    assert.equal(restoredUser.passwordHash, null);
    assert.equal(restoredUser.forcePasswordChange, true);

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

  it("includes Daily Admin OS data in full backups and restores it", async () => {
    process.env.UWE_UPLOADS_ROOT = uploadsRoot;
    const db = createPrismaClient(databaseUrl);
    // Daily-admin/Brain rows are owner-private and live in the Brain DB that
    // createBackupBundle reads via BRAIN_DATABASE_URL (set in before()).
    const brainDb = createBrainPrismaClient();
    const familyDb = createFamilyPrismaClient();
    const world = await db.world.findUniqueOrThrow({ where: { slug: worldSlug } });

    const captureStorageKey = buildStorageKey("_capture", "capture-photo.png");
    ensureUploadDirectory("_capture", uploadsRoot);
    fs.writeFileSync(
      resolveAssetFilePath(captureStorageKey, uploadsRoot),
      Buffer.from("capture-bytes"),
    );

    const capture = await brainDb.captureEntry.create({
      data: {
        title: "Idee für Werkstatt",
        content: "Neues Terrain bauen",
        captureType: "file_image",
        status: "inbox",
        storageKey: captureStorageKey,
        worldId: world.id,
      },
    });
    const personalProject = await brainDb.personalProject.create({
      data: {
        name: "Balkon renovieren",
        status: "active",
        category: "other",
      },
    });
    const workshopProject = await brainDb.workshopProject.create({
      data: {
        title: "Turm-Terrain",
        projectType: "dnd_terrain",
        status: "in_progress",
      },
    });
    await brainDb.workshopPaintRecipe.create({
      data: {
        name: "Steingrau",
        targetType: "terrain",
        workshopProjectId: workshopProject.id,
      },
    });
    await brainDb.workshopPrintProfile.create({
      data: { name: "0.2mm Standard", workshopProjectId: workshopProject.id },
    });
    await brainDb.workshopTerrainRental.create({
      data: { terrainSetName: "Dungeon-Set", workshopProjectId: workshopProject.id },
    });
    await familyDb.contractExpense.create({
      data: { name: "Internet-Vertrag", vendor: "ISP", amountCents: 3999 },
    });
    await brainDb.hardwareDevice.create({
      data: { name: "RTX-Host", role: "ai", status: "active", hostname: "rtx.local" },
    });
    const brainDocument = await brainDb.personalBrainDocument.create({
      data: { title: "Hausnotizen", content: "Zählerstände und Wartung" },
    });
    await brainDb.personalBrainChunk.create({
      data: {
        documentId: brainDocument.id,
        chunkIndex: 0,
        content: "Zählerstände und Wartung",
      },
    });
    await brainDb.personalBrainFact.create({
      data: { factType: "custom", title: "WLAN-Kanal", content: "Kanal 36" },
    });
    await brainDb.adminEntityLink.create({
      data: {
        sourceType: "capture",
        sourceId: capture.id,
        targetType: "personal_project",
        targetId: personalProject.id,
      },
    });
    await db.$disconnect();
    await brainDb.$disconnect();

    const bundle = await createBackupBundle(databaseUrl, { type: "full" });
    assert.ok(bundle.data.dailyAdmin);
    assert.equal(bundle.data.dailyAdmin!.captureEntries.length, 1);
    assert.equal(bundle.data.dailyAdmin!.personalProjects.length, 1);
    assert.equal(bundle.data.dailyAdmin!.workshopProjects.length, 1);
    assert.equal(bundle.data.dailyAdmin!.workshopPaintRecipes.length, 1);
    assert.equal(bundle.data.dailyAdmin!.workshopPrintProfiles.length, 1);
    assert.equal(bundle.data.dailyAdmin!.workshopTerrainRentals.length, 1);
    assert.equal(bundle.data.dailyAdmin!.contractExpenses.length, 1);
    assert.equal(bundle.data.dailyAdmin!.hardwareDevices.length, 1);
    assert.equal(bundle.data.dailyAdmin!.personalBrainDocuments.length, 1);
    assert.equal(bundle.data.dailyAdmin!.personalBrainChunks.length, 1);
    assert.equal(bundle.data.dailyAdmin!.personalBrainFacts.length, 1);
    assert.equal(bundle.data.dailyAdmin!.adminEntityLinks.length, 1);
    assert.equal(bundle.manifest.stats.dailyAdminEntities, 12);

    const zipPath = path.join(backupsDir, "daily-admin-roundtrip.zip");
    writeBackupZip(bundle, zipPath, uploadsRoot);
    assert.ok(bundle.manifest.assetFiles.includes(`assets/${captureStorageKey}`));
    const zipBuffer = fs.readFileSync(zipPath);

    const targetDbUrl = createTestDatabaseUrl();
    const targetUploads = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-da-restore-"));
    const targetDb = createPrismaClient(targetDbUrl);
    const targetBrainDb = createTestBrainClient();
    const targetFamilyDb = createTestFamilyClient();
    const loaded = loadBackupFromBuffer(zipBuffer, "daily-admin-roundtrip.zip");

    const result = await executeRestore(targetDb, targetBrainDb, targetFamilyDb, loaded, {
      confirmed: true,
      autoResolveSlugConflicts: true,
    }, zipBuffer, targetUploads);

    assert.equal(result.errors.length, 0);
    assert.equal(await targetBrainDb.captureEntry.count(), 1);
    assert.equal(await targetBrainDb.personalProject.count(), 1);
    assert.equal(await targetBrainDb.workshopProject.count(), 1);
    assert.equal(await targetBrainDb.workshopPaintRecipe.count(), 1);
    assert.equal(await targetBrainDb.workshopPrintProfile.count(), 1);
    assert.equal(await targetBrainDb.workshopTerrainRental.count(), 1);
    assert.equal(await targetFamilyDb.contractExpense.count(), 1);
    assert.equal(await targetBrainDb.hardwareDevice.count(), 1);
    assert.equal(await targetBrainDb.personalBrainDocument.count(), 1);
    assert.equal(await targetBrainDb.personalBrainChunk.count(), 1);
    assert.equal(await targetBrainDb.personalBrainFact.count(), 1);
    assert.equal(await targetBrainDb.adminEntityLink.count(), 1);

    const restoredCapture = await targetBrainDb.captureEntry.findFirstOrThrow();
    assert.equal(restoredCapture.storageKey, captureStorageKey);
    assert.ok(
      fs.existsSync(resolveAssetFilePath(captureStorageKey, targetUploads)),
      "Capture-Upload-Datei muss mit wiederhergestellt werden",
    );

    const restoredRecipe = await targetBrainDb.workshopPaintRecipe.findFirstOrThrow();
    const restoredWorkshopProject = await targetBrainDb.workshopProject.findFirstOrThrow();
    assert.equal(restoredRecipe.workshopProjectId, restoredWorkshopProject.id);

    const restoredChunk = await targetBrainDb.personalBrainChunk.findFirstOrThrow();
    const restoredDocument = await targetBrainDb.personalBrainDocument.findFirstOrThrow();
    assert.equal(restoredChunk.documentId, restoredDocument.id);

    const restoredLink = await targetBrainDb.adminEntityLink.findFirstOrThrow();
    assert.equal(restoredLink.sourceId, restoredCapture.id);
    assert.equal(
      restoredLink.targetId,
      (await targetBrainDb.personalProject.findFirstOrThrow()).id,
    );

    await targetDb.$disconnect();
    await targetBrainDb.$disconnect();
    fs.rmSync(targetUploads, { recursive: true, force: true });
  });

  it("restores legacy archives without a daily admin section", async () => {
    const bundle = await createBackupBundle(databaseUrl, { type: "full" });
    delete bundle.data.dailyAdmin;
    delete bundle.manifest.stats.dailyAdminEntities;

    const targetDbUrl = createTestDatabaseUrl();
    const targetDb = createPrismaClient(targetDbUrl);
    const targetBrainDb = createTestBrainClient();
    const targetFamilyDb = createTestFamilyClient();

    const result = await executeRestore(targetDb, targetBrainDb, targetFamilyDb, bundle, {
      confirmed: true,
      autoResolveSlugConflicts: true,
    });

    assert.equal(result.errors.length, 0);
    assert.ok(result.created > 0);
    assert.equal(await targetBrainDb.captureEntry.count(), 0);
    assert.ok(await targetDb.world.findUnique({ where: { slug: worldSlug } }));

    await targetDb.$disconnect();
    await targetBrainDb.$disconnect();
  });
});
