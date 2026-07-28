import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import {
  createPage,
  createUweRepository,
  createWorld,
  seedTerraWorld,
} from "@uwe/database/server";
import {
  buildAiContext,
  resolveContextBuilderConfig,
  toAiRunContextSnapshot,
} from "./index";

describe("Context Builder — config and budget", () => {
  const originalMax = process.env.BRAIN_MAX_CONTEXT_CHARS;

  afterEach(() => {
    if (originalMax === undefined) delete process.env.BRAIN_MAX_CONTEXT_CHARS;
    else process.env.BRAIN_MAX_CONTEXT_CHARS = originalMax;
  });

  it("reads BRAIN_MAX_CONTEXT_CHARS from env", () => {
    process.env.BRAIN_MAX_CONTEXT_CHARS = "5000";
    const config = resolveContextBuilderConfig();
    assert.equal(config.maxChars, 5000);
  });

  it("truncates context when maxChars is exceeded", async () => {
    const databaseUrl = createTestDatabaseUrl();
    const repo = createUweRepository(databaseUrl);
    const world = await createWorld({ name: "Budget", slug: "budget" }, databaseUrl);

    const page = await createPage(
      {
        worldId: world.id,
        title: "Lange Seite",
        slug: "lang",
        type: "lore",
        canonicalStatus: "canon",
        contentBlocks: [
          {
            type: "rich_text",
            sortOrder: 0,
            content: "A".repeat(800),
          },
        ],
      },
      databaseUrl,
    );

    const context = await buildAiContext(repo, "summarize_page", world.id, page.id, {
      maxChars: 300,
    });

    assert.equal(context.truncated, true);
    assert.ok(context.promptContext.length <= 300);
    assert.ok(context.debug);
    assert.equal(context.debug?.truncated, true);
    assert.equal(context.debug?.maxChars, 300);

    const { createPrismaClient } = await import("@uwe/database/server");
    await createPrismaClient(databaseUrl).$disconnect();
  });
});

describe("Context Builder — world, campaign and debug snapshot", () => {
  let databaseUrl: string;

  beforeEach(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  afterEach(async () => {
    const { createPrismaClient } = await import("@uwe/database/server");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("includes world metadata and debug items", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);

    const context = await buildAiContext(
      repo,
      "summarize_page",
      seeded.world.id,
      seeded.pages.arbor.id,
      { allowDmOnly: false },
    );

    assert.ok(context.world);
    assert.equal(context.world?.slug, seeded.world.slug);
    assert.ok(context.debug);
    assert.ok(context.debug?.items.some((item) => item.kind === "world"));
    assert.ok(context.promptContext.includes(seeded.world.name));
  });

  it("produces an AI run context snapshot with sources and stats", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);

    const context = await buildAiContext(
      repo,
      "summarize_page",
      seeded.world.id,
      seeded.pages.arbor.id,
      { allowDmOnly: false },
    );

    const snapshot = toAiRunContextSnapshot(context);

    assert.equal(snapshot.taskType, "summarize_page");
    assert.equal(snapshot.worldId, seeded.world.id);
    assert.ok(Array.isArray(snapshot.sources));
    assert.ok(snapshot.stats);
    assert.equal((snapshot.stats as { pageCount: number }).pageCount, context.pages.length);
    assert.ok(snapshot.debug);
  });
});

describe("Context Builder — brain knowledge source", () => {
  let databaseUrl: string;

  beforeEach(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  afterEach(async () => {
    const { createPrismaClient } = await import("@uwe/database/server");
    await createPrismaClient(databaseUrl).$disconnect();
  });

});

