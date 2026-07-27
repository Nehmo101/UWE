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
  createContextBuilder,
  resolveContextBuilderConfig,
  toAiRunContextSnapshot,
  type BrainKnowledgeEntry,
  type BrainKnowledgeSource,
} from "./index";

describe("Context Builder — config and budget", () => {
  const originalMax = process.env.BRAIN_MAX_CONTEXT_CHARS;
  const originalAllow = process.env.BRAIN_ALLOW_DM_ONLY_CONTEXT;

  afterEach(() => {
    if (originalMax === undefined) delete process.env.BRAIN_MAX_CONTEXT_CHARS;
    else process.env.BRAIN_MAX_CONTEXT_CHARS = originalMax;
    if (originalAllow === undefined) delete process.env.BRAIN_ALLOW_DM_ONLY_CONTEXT;
    else process.env.BRAIN_ALLOW_DM_ONLY_CONTEXT = originalAllow;
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
        visibility: "public",
        canonicalStatus: "canon",
        contentBlocks: [
          {
            type: "rich_text",
            sortOrder: 0,
            visibility: "public",
            content: "A".repeat(800),
          },
        ],
      },
      databaseUrl,
    );

    const context = await buildAiContext(repo, "summarize_page", world.id, page.id, {
      allowDmOnly: false,
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

  it("includes brain entries and filters dm_only for player audience", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);

    const mockBrainSource: BrainKnowledgeSource = {
      async findRelevant() {
        const entries: BrainKnowledgeEntry[] = [
          {
            id: "brain-public",
            title: "Öffentliches Wissen",
            content: "Spieler dürfen das wissen.",
            visibility: "public",
            sourceType: "fact",
          },
          {
            id: "brain-secret",
            title: "DM-Geheimnis",
            content: "Nur für den DM.",
            visibility: "dm_only",
            sourceType: "fact",
          },
        ];
        return entries;
      },
    };

    const builder = createContextBuilder(repo, { brainSource: mockBrainSource });

    const dmContext = await builder.build({
      taskType: "summarize_page",
      worldId: seeded.world.id,
      pageId: seeded.pages.arbor.id,
      options: { allowDmOnly: true },
    });

    assert.equal(dmContext.brainEntries?.length, 2);
    assert.ok(dmContext.promptContext.includes("Öffentliches Wissen"));
    assert.ok(dmContext.promptContext.includes("DM-Geheimnis"));

    const playerContext = await builder.build({
      taskType: "generate_player_recap",
      worldId: seeded.world.id,
      pageId: seeded.pages.arbor.id,
      options: { allowDmOnly: true },
    });

    assert.equal(playerContext.brainEntries?.length, 1);
    assert.equal(playerContext.brainEntries?.[0]?.entryId, "brain-public");
    assert.ok(!playerContext.promptContext.includes("DM-Geheimnis"));
    assert.equal(playerContext.debug?.audience, "player_visible");
  });
});

describe("Context Builder — BRAIN_ALLOW_DM_ONLY_CONTEXT guard", () => {
  const originalAllow = process.env.BRAIN_ALLOW_DM_ONLY_CONTEXT;

  afterEach(() => {
    if (originalAllow === undefined) delete process.env.BRAIN_ALLOW_DM_ONLY_CONTEXT;
    else process.env.BRAIN_ALLOW_DM_ONLY_CONTEXT = originalAllow;
  });

  it("blocks dm_only when BRAIN_ALLOW_DM_ONLY_CONTEXT is false", async () => {
    process.env.BRAIN_ALLOW_DM_ONLY_CONTEXT = "false";
    const databaseUrl = createTestDatabaseUrl();
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);

    const context = await buildAiContext(
      repo,
      "find_open_threads",
      seeded.world.id,
      seeded.pages.validori.id,
      { allowDmOnly: true, localOnly: true },
    );

    assert.equal(context.allowDmOnly, false);
    assert.ok(
      context.pages.every((page) =>
        page.contentBlocks.every((block) => block.visibility !== "dm_only"),
      ),
    );

    const { createPrismaClient } = await import("@uwe/database/server");
    await createPrismaClient(databaseUrl).$disconnect();
  });
});
