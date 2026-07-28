import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createEntityTagService } from "./entity-tag-service";
import { createLifeAdminService } from "./life-admin-service";
import { createUweRepository } from "./repository";
import { searchStudioCrossDomain } from "./cross-domain-search-service";
import { searchEntitiesByTagQuery } from "./entity-tag-search-service";
import { createTestBrainClient, createTestDatabaseUrl, type BrainPrismaClient } from "./test-helpers";

describe("cross-domain search service", () => {
  let db: PrismaClient;
  let brainDb: BrainPrismaClient;
  let databaseUrl: string;
  let worldId: string;
  let worldSlug: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    brainDb = createTestBrainClient();
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({
      name: "Cross Search World",
      slug: `cross-search-${Date.now()}`,
    });
    worldId = world.id;
    worldSlug = world.slug;
  });

  it("finds wiki pages, admin captures, media assets, and tag hits", async () => {
    const repo = createUweRepository(databaseUrl);
    const lifeAdmin = createLifeAdminService(brainDb, db);
    const entityTags = createEntityTagService(db);

    const page = await repo.createPage({
      worldId,
      title: "Cross Search Alpha Page",
      slug: "cross-search-alpha-page",
      type: "note",
      tags: ["alpha-cross-tag"],
    });

    const capture = await lifeAdmin.createCapture({
      title: "Cross Search Alpha Capture",
      content: "Unique capture body for cross search",
      metadata: { tags: ["alpha-cross-tag"] },
      worldId,
    });

    await db.asset.create({
      data: {
        worldId,
        title: "Cross Search Alpha Asset",
        description: "A distinctive asset description",
        type: "image",
        storageKey: `worlds/${worldSlug}/alpha.png`,
      },
    });

    await entityTags.attachTag({
      tagKey: "alpha-cross-tag",
      entityType: "capture",
      entityId: capture.id,
      worldId,
    });

    const result = await searchStudioCrossDomain(db, brainDb, {
      query: "Cross Search Alpha",
      scope: "all",
      wiki: { worldSlug, limit: 20 },
      admin: { limit: 20 },
    });

    assert.ok(result.wiki.some((entry) => entry.pageId === page.id));
    assert.ok(result.admin.some((entry) => entry.id === capture.id));
    assert.ok(result.media.some((entry) => entry.title.includes("Alpha Asset")));

    const tagHits = await searchEntitiesByTagQuery(db, brainDb, {
      query: "alpha-cross-tag",
      limit: 10,
    });
    assert.ok(tagHits.some((entry) => entry.id === capture.id));

    const tagScoped = await searchStudioCrossDomain(db, brainDb, {
      query: "alpha-cross-tag",
      scope: "all",
    });
    assert.ok(tagScoped.tags.some((entry) => entry.id === capture.id));

    await db.page.delete({ where: { id: page.id } });
    await lifeAdmin.deleteCapture(capture.id);
  });
});

describe("entity tag search service", () => {
  let db: PrismaClient;
  let brainDb: BrainPrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    brainDb = createTestBrainClient();
  });

  it("returns entities linked to matching tag labels", async () => {
    const lifeAdmin = createLifeAdminService(brainDb, db);
    const entityTags = createEntityTagService(db);

    const capture = await lifeAdmin.createCapture({
      title: "Tag Search Capture",
      content: "Body without keyword",
      metadata: { tags: ["homelab-backlog"] },
    });

    await entityTags.attachTag({
      tagKey: "homelab-backlog",
      entityType: "capture",
      entityId: capture.id,
    });

    const hits = await searchEntitiesByTagQuery(db, brainDb, {
      query: "homelab-backlog",
      limit: 10,
    });

    assert.ok(hits.some((hit) => hit.id === capture.id && hit.entityType === "capture"));
    assert.ok(hits[0]?.matchedTags.includes("homelab-backlog"));

    await lifeAdmin.deleteCapture(capture.id);
  });
});
