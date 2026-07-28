import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createLifeAdminService } from "./life-admin-service";
import { createUweRepository } from "./repository";
import {
  adoptAssetToTarget,
  linkAssetToTarget,
  listAssetLinksForAsset,
  listAssetsForTarget,
  syncImageStudioProjectLinksToAsset,
} from "./asset-link-service";
import { createTestBrainClient, createTestDatabaseUrl, type BrainPrismaClient } from "./test-helpers";

describe("asset link service", () => {
  let db: PrismaClient;
  let brainDb: BrainPrismaClient;
  let worldId: string;
  let pageId: string;
  let assetId: string;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    brainDb = createTestBrainClient();
    const repo = createUweRepository(databaseUrl);
    const lifeAdmin = createLifeAdminService(brainDb, db);

    const world = await repo.createWorld({
      name: "Asset Link World",
      slug: "asset-link-world",
      description: "Asset link tests",
    });
    worldId = world.id;

    const page = await repo.createPage({
      worldId,
      title: "NPC Portrait",
      slug: "npc-portrait",
      type: "npc",
    });
    pageId = page.id;

    const asset = await repo.createAsset({
      worldId,
      title: "Portrait Draft",
      type: "image",
      storageKey: `${worldId}/test-portrait.png`,
      mimeType: "image/png",
    });
    assetId = asset.id;

    const capture = await lifeAdmin.createCapture({ title: "Photo capture" });
    await linkAssetToTarget(db, brainDb, {
      assetId,
      targetType: "capture",
      targetId: capture.id,
    });
  });

  it("links assets to pages", async () => {
    await linkAssetToTarget(db, brainDb, { assetId, targetType: "page", targetId: pageId });
    const assets = await listAssetsForTarget(db, brainDb, "page", pageId);
    assert.ok(assets.some((asset) => asset.id === assetId));
  });

  it("lists all links for an asset", async () => {
    const links = await listAssetLinksForAsset(db, brainDb, assetId);
    assert.ok(links.some((link) => link.targetType === "page"));
    assert.ok(links.some((link) => link.targetType === "capture"));
  });

  it("adopts asset to workshop project gallery", async () => {
    const lifeAdmin = createLifeAdminService(brainDb, db);
    const workshop = await lifeAdmin.createWorkshopProject({
      title: "Goblin Mini",
      projectType: "miniature",
    });

    await adoptAssetToTarget(db, brainDb, {
      assetId,
      targetType: "workshop_project",
      targetId: workshop.id,
    });

    const updated = await lifeAdmin.getWorkshopProject(workshop.id);
    const gallery = Array.isArray(updated?.imageGallery) ? (updated!.imageGallery as string[]) : [];
    assert.ok(gallery.includes(assetId));
  });

  it("syncs image studio project links to asset", async () => {
    const project = await db.imageStudioProject.create({
      data: {
        worldId,
        title: "Linked project",
        status: "processing",
      },
    });

    await db.imageStudioLink.create({
      data: {
        projectId: project.id,
        targetType: "page",
        targetId: pageId,
      },
    });

    const links = await syncImageStudioProjectLinksToAsset(db, brainDb, project.id, assetId);
    assert.ok(links.some((link) => link.targetType === "page" && link.targetId === pageId));
  });
});
