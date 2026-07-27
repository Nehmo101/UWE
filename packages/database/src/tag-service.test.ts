import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createEntityTagService } from "./entity-tag-service";
import { createLifeAdminService } from "./life-admin-service";
import { createUweRepository } from "./repository";
import { seedStressWorld } from "./stress-seed";
import { PERF_SMOKE_SCALE } from "./perf-budgets";
import {
  canonicalizeTag,
  collectTagInventory,
  findSimilarTagGroups,
  findUnusedTags,
  mergeTags,
  normalizeTagKey,
  suggestTagMerges,
  backfillEntityTagsFromJson,
  getTagCoverageStats,
  verifyTagBackfill,
} from "./tag-service";
import { createTestBrainClient, createTestDatabaseUrl, type BrainPrismaClient } from "./test-helpers";
import { toPrismaJsonValue } from "./json-utils";

describe("tag service", () => {
  let db: PrismaClient;
  let brainDb: BrainPrismaClient;
  let worldId: string;
  let databaseUrl: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    brainDb = createTestBrainClient();
    const repo = createUweRepository(databaseUrl);
    const result = await seedStressWorld(repo, db, brainDb, {
      ...PERF_SMOKE_SCALE,
      pages: 30,
      links: 40,
      assets: 10,
      captures: 5,
      sessions: 3,
      handouts: 5,
      workshopProjects: 3,
      personalBrainDocs: 8,
      tagVariants: 20,
    });
    worldId = result.worldId;
  });

  it("normalizes tag keys for comparison", () => {
    assert.equal(normalizeTagKey("  Stadt "), "stadt");
    assert.equal(normalizeTagKey("Wälder"), "waelder");
    assert.equal(canonicalizeTag("  NPC "), "npc");
  });

  it("collects tag inventory across entities", async () => {
    const inventory = await collectTagInventory(db, brainDb, { worldId });
    assert.ok(inventory.length >= 5);
    const stadt = inventory.find((entry) => entry.tag === "stadt" || entry.tag === "Stadt");
    assert.ok(stadt);
    assert.ok(stadt!.count >= 1);
  });

  it("finds similar tag groups from variants", async () => {
    const inventory = await collectTagInventory(db, brainDb, { worldId });
    const groups = findSimilarTagGroups(inventory);
    assert.ok(groups.length >= 1);
    const suggestions = suggestTagMerges(inventory);
    assert.ok(suggestions.length >= 1);
    assert.ok(suggestions[0]!.sourceTags.length >= 1);
  });

  it("flags low-visibility tags as unused candidates", async () => {
    const inventory = await collectTagInventory(db, brainDb, { worldId });
    const unused = findUnusedTags(inventory);
    assert.ok(Array.isArray(unused));
  });

  it("merges tags across pages and assets", async () => {
    const repo = createUweRepository(databaseUrl);
    await repo.createPage({
      worldId,
      title: "Tag Merge A",
      slug: "tag-merge-a",
      type: "note",
      tags: ["Stadt"],
    });
    await repo.createPage({
      worldId,
      title: "Tag Merge B",
      slug: "tag-merge-b",
      type: "note",
      tags: ["STADT"],
    });

    const result = await mergeTags(db, brainDb, {
      worldId,
      fromTags: ["Stadt", "STADT"],
      toTag: "stadt",
    });
    assert.ok(result.updatedEntities >= 1);

    const after = await collectTagInventory(db, brainDb, { worldId });
    assert.ok(!after.some((entry) => entry.tag === "Stadt" || entry.tag === "STADT"));
  });

  it("backfills entity tags from json tag arrays", async () => {
    const repo = createUweRepository(databaseUrl);
    const page = await repo.createPage({
      worldId,
      title: "Backfill Tag Page",
      slug: "backfill-tag-page",
      type: "note",
      tags: ["quest", "hook"],
    });

    const result = await backfillEntityTagsFromJson(db, brainDb, { worldId });
    assert.ok(result.entitiesProcessed >= 1);
    assert.ok(result.entityTagsCreated >= 2);

    const coverage = await getTagCoverageStats(db, brainDb, { worldId });
    const pageStats = coverage.types.find((entry) => entry.entityType === "page");
    assert.ok(pageStats);
    assert.ok(pageStats!.entityTagTagged >= 1);

    const inventory = await collectTagInventory(db, brainDb, { worldId });
    assert.ok(inventory.some((entry) => entry.tag === "quest" || entry.tag === "hook"));

    await db.page.delete({ where: { id: page.id } });
  });

  it("backfills entity tags from capture metadata.tags", async () => {
    const lifeAdmin = createLifeAdminService(brainDb, db);
    const capture = await lifeAdmin.createCapture({
      title: "Metadata Tag Capture",
      content: "Tagged via metadata",
      metadata: { tags: ["inbox", "triage"] },
      worldId,
    });

    const result = await backfillEntityTagsFromJson(db, brainDb, { worldId });
    assert.ok(result.entitiesProcessed >= 1);

    const coverage = await getTagCoverageStats(db, brainDb, { worldId });
    const captureStats = coverage.types.find((entry) => entry.entityType === "capture");
    assert.ok(captureStats);
    assert.ok(captureStats!.jsonTagged >= 1);
    assert.ok(captureStats!.entityTagTagged >= 1);

    const mergeResult = await mergeTags(db, brainDb, {
      worldId,
      fromTags: ["inbox"],
      toTag: "eingang",
    });
    assert.ok(mergeResult.updatedEntities >= 1);

    const updated = await lifeAdmin.getCapture(capture.id);
    assert.ok(updated);
    const metadata = updated!.metadata as { tags?: string[] };
    assert.ok(metadata.tags?.includes("eingang"));
    assert.ok(!metadata.tags?.includes("inbox"));

    await lifeAdmin.deleteCapture(capture.id);
  });

  it("uses EntityTag as primary inventory and merge source after backfill", async () => {
    const repo = createUweRepository(databaseUrl);
    const entityTags = createEntityTagService(db);
    const page = await repo.createPage({
      worldId,
      title: "EntityTag Primary Page",
      slug: "entitytag-primary-page",
      type: "note",
      tags: ["entity-primary-tag"],
    });

    await backfillEntityTagsFromJson(db, brainDb, { worldId });
    await db.page.update({
      where: { id: page.id },
      data: { tags: toPrismaJsonValue([]) },
    });

    const inventory = await collectTagInventory(db, brainDb, { worldId });
    assert.ok(
      inventory.some(
        (entry) =>
          entry.tag === "entity-primary-tag" ||
          entry.references.some((ref) => ref.entityId === page.id),
      ),
    );

    const mergeResult = await mergeTags(db, brainDb, {
      worldId,
      fromTags: ["entity-primary-tag"],
      toTag: "primary",
    });
    assert.ok(mergeResult.updatedEntities >= 1);

    const linked = await entityTags.listTagsForEntity("page", page.id);
    assert.ok(linked.some((tag) => tag.label === "primary"));

    await db.page.delete({ where: { id: page.id } });
  });

  it("verifies backfill completeness and reports missing EntityTag links", async () => {
    const repo = createUweRepository(databaseUrl);
    const page = await repo.createPage({
      worldId,
      title: "Verify Gap Page",
      slug: "verify-gap-page",
      type: "note",
      tags: ["Verify Gap Tag"],
    });

    const before = await verifyTagBackfill(db, brainDb, { worldId });
    assert.equal(before.ok, false);
    const pageStats = before.types.find((entry) => entry.entityType === "page");
    assert.ok(pageStats);
    const miss = pageStats!.missing.find((entry) => entry.entityId === page.id);
    assert.ok(miss, "page without EntityTag rows must be reported as missing");
    assert.deepEqual(miss!.missingTagKeys, ["verify-gap-tag"]);
    assert.ok(before.totalMissingLinks >= 1);

    await backfillEntityTagsFromJson(db, brainDb, { worldId });

    const after = await verifyTagBackfill(db, brainDb, { worldId });
    assert.equal(after.ok, true);
    assert.equal(after.totalEntitiesMissing, 0);
    assert.equal(after.totalMissingLinks, 0);
    const pageStatsAfter = after.types.find((entry) => entry.entityType === "page");
    assert.ok(pageStatsAfter!.entitiesWithJsonTags >= 1);
    assert.equal(pageStatsAfter!.entitiesWithJsonTags, pageStatsAfter!.entitiesFullyCovered);

    await db.page.delete({ where: { id: page.id } });
  });

  it("keeps json and EntityTag in sync through merges (dual-write regression)", async () => {
    const repo = createUweRepository(databaseUrl);
    const entityTags = createEntityTagService(db);
    const page = await repo.createPage({
      worldId,
      title: "Dual Write Merge Page",
      slug: "dual-write-merge-page",
      type: "note",
      tags: ["dualwrite-old"],
    });

    await backfillEntityTagsFromJson(db, brainDb, { worldId });

    const result = await mergeTags(db, brainDb, {
      worldId,
      fromTags: ["dualwrite-old"],
      toTag: "dualwrite-new",
    });
    assert.ok(result.updatedEntities >= 1);

    const updated = await db.page.findUnique({
      where: { id: page.id },
      select: { tags: true },
    });
    assert.deepEqual(updated!.tags, ["dualwrite-new"]);
    const linked = await entityTags.listTagsForEntity("page", page.id);
    assert.ok(linked.some((tag) => tag.label === "dualwrite-new"));
    assert.ok(!linked.some((tag) => tag.label === "dualwrite-old"));

    const verification = await verifyTagBackfill(db, brainDb, { worldId });
    assert.equal(verification.ok, true);

    await db.page.delete({ where: { id: page.id } });
  });
});
