import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { seedStressWorld } from "./stress-seed";
import { PERF_BUDGETS_MS, PERF_SMOKE_SCALE, assertWithinBudget } from "./perf-budgets";
import { createTagService } from "./tag-service";
import { createLifeAdminService } from "./life-admin-service";
import { createTestBrainClient, createTestDatabaseUrl, type BrainPrismaClient } from "./test-helpers";
import { buildSearchIndexForScope } from "./search-index";
import { searchForWikiContext } from "./search-service";

function elapsed(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

describe("performance smoke", () => {
  let db: PrismaClient;
  let brainDb: BrainPrismaClient;
  let databaseUrl: string;
  let worldSlug: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    brainDb = createTestBrainClient();
    const repo = createUweRepository(databaseUrl);
    const result = await seedStressWorld(repo, db, brainDb, PERF_SMOKE_SCALE);
    worldSlug = result.worldSlug;
  });

  it("lists pages within budget", async () => {
    const start = process.hrtime.bigint();
    const repo = createUweRepository(databaseUrl);
    const pages = await repo.listPagesByWorld(worldSlug);
    const ms = elapsed(start);
    assert.ok(pages.length >= PERF_SMOKE_SCALE.pages);
    assertWithinBudget("listPages", ms, PERF_BUDGETS_MS.listPages);
  });

  it("builds search index within budget", async () => {
    const pages = await db.page.findMany({
      where: { world: { slug: worldSlug } },
      include: {
        contentBlocks: { orderBy: { sortOrder: "asc" } },
        world: { select: { slug: true, name: true } },
        campaign: { select: { name: true } },
      },
    });
    const start = process.hrtime.bigint();
    buildSearchIndexForScope(pages, "studio");
    const ms = elapsed(start);
    assertWithinBudget("searchIndexBuild", ms, PERF_BUDGETS_MS.searchIndexBuild);
  });

  it("runs global search within budget", async () => {
    const start = process.hrtime.bigint();
    const results = await searchForWikiContext(db, "dm", {
      query: "Perf Page",
      worldSlug,
      limit: 25,
    });
    const ms = elapsed(start);
    assert.ok(results.length > 0);
    assertWithinBudget("searchQuery", ms, PERF_BUDGETS_MS.searchQuery);
  });

  it("aggregates today summary within budget", async () => {
    const lifeAdmin = createLifeAdminService(brainDb, db);
    const start = process.hrtime.bigint();
    const summary = await lifeAdmin.getTodaySummary();
    const ms = elapsed(start);
    assert.ok(summary.inboxCaptureCount >= 1);
    assertWithinBudget("todaySummary", ms, PERF_BUDGETS_MS.todaySummary);
  });

  it("lists assets within budget", async () => {
    const start = process.hrtime.bigint();
    const repo = createUweRepository(databaseUrl);
    const assets = await repo.listAssetsByWorld(worldSlug);
    const ms = elapsed(start);
    assert.ok(assets.length >= PERF_SMOKE_SCALE.assets);
    assertWithinBudget("listAssets", ms, PERF_BUDGETS_MS.listAssets);
  });

  it("scans tag inventory within budget", async () => {
    const tags = createTagService(brainDb, db);
    const start = process.hrtime.bigint();
    const inventory = await tags.collectInventory();
    const ms = elapsed(start);
    assert.ok(inventory.length >= 10);
    assert.ok(inventory.some((entry) => entry.references.some((ref) => ref.entityType === "asset")));
    assertWithinBudget("tagInventory", ms, PERF_BUDGETS_MS.tagInventory);
  });

  it("searches personal brain within budget", async () => {
    const lifeAdmin = createLifeAdminService(brainDb, db);
    const start = process.hrtime.bigint();
    const results = await lifeAdmin.searchPersonalBrain({ query: "homelab", limit: 10 });
    const ms = elapsed(start);
    assert.ok(results.documents.length >= 1);
    assertWithinBudget("personalBrainSearch", ms, PERF_BUDGETS_MS.personalBrainSearch);
  });
});
