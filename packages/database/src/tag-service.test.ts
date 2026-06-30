import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
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
} from "./tag-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("tag service", () => {
  let db: PrismaClient;
  let worldId: string;
  let databaseUrl: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const result = await seedStressWorld(repo, db, {
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
    const inventory = await collectTagInventory(db, { worldId });
    assert.ok(inventory.length >= 5);
    const stadt = inventory.find((entry) => entry.tag === "stadt" || entry.tag === "Stadt");
    assert.ok(stadt);
    assert.ok(stadt!.count >= 1);
  });

  it("finds similar tag groups from variants", async () => {
    const inventory = await collectTagInventory(db, { worldId });
    const groups = findSimilarTagGroups(inventory);
    assert.ok(groups.length >= 1);
    const suggestions = suggestTagMerges(inventory);
    assert.ok(suggestions.length >= 1);
    assert.ok(suggestions[0]!.sourceTags.length >= 1);
  });

  it("flags low-visibility tags as unused candidates", async () => {
    const inventory = await collectTagInventory(db, { worldId });
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
      visibility: "player_visible",
      publishStatus: "published",
    });
    await repo.createPage({
      worldId,
      title: "Tag Merge B",
      slug: "tag-merge-b",
      type: "note",
      tags: ["STADT"],
      visibility: "player_visible",
      publishStatus: "published",
    });

    const result = await mergeTags(db, {
      worldId,
      fromTags: ["Stadt", "STADT"],
      toTag: "stadt",
    });
    assert.ok(result.updatedEntities >= 1);

    const after = await collectTagInventory(db, { worldId });
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
      visibility: "player_visible",
      publishStatus: "published",
    });

    const result = await backfillEntityTagsFromJson(db, { worldId });
    assert.ok(result.entitiesProcessed >= 1);
    assert.ok(result.entityTagsCreated >= 2);

    const coverage = await getTagCoverageStats(db, { worldId });
    const pageStats = coverage.types.find((entry) => entry.entityType === "page");
    assert.ok(pageStats);
    assert.ok(pageStats!.entityTagTagged >= 1);

    const inventory = await collectTagInventory(db, { worldId });
    assert.ok(inventory.some((entry) => entry.tag === "quest" || entry.tag === "hook"));

    await db.page.delete({ where: { id: page.id } });
  });
});
