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
  AiPrivacyError,
  buildAiContext,
  contextContainsDmOnly,
  generateAiTask,
  InMemoryApiKeyStore,
  saveAiResultAsContentBlock,
  saveAiResultAsIdea,
  sanitizeContextForCloud,
  validateProviderForContext,
} from "./index";

describe("AI Brain — buildAiContext", () => {
  let databaseUrl: string;

  beforeEach(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  afterEach(async () => {
    const { createPrismaClient } = await import("@uwe/database/server");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("includes the primary page and related linked pages", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);

    const context = await buildAiContext(
      repo,
      "summarize_page",
      seeded.world.id,
      seeded.pages.validori.id,
      { allowDmOnly: true },
    );

    const pageIds = context.pages.map((page) => page.pageId);
    assert.ok(pageIds.includes(seeded.pages.validori.id));
    assert.ok(pageIds.includes(seeded.pages.magisterTurm.id));
    assert.equal(context.primaryPageId, seeded.pages.validori.id);
    assert.ok(context.sources.some((source) => source.pageId === seeded.pages.validori.id));
  });

  it("respects visibility when DM-only content is disallowed", async () => {
    const repo = createUweRepository(databaseUrl);
    const world = await createWorld({ name: "Sichtbarkeit", slug: "sichtbarkeit" }, databaseUrl);

    const publicPage = await createPage(
      {
        worldId: world.id,
        title: "Öffentliche Seite",
        slug: "oeffentlich",
        type: "lore",
        visibility: "public",
        publishStatus: "published",
        canonicalStatus: "canon",
        contentBlocks: [
          {
            type: "rich_text",
            sortOrder: 0,
            visibility: "public",
            content: "Spieler sichtbarer Text.",
          },
        ],
      },
      databaseUrl,
    );

    await createPage(
      {
        worldId: world.id,
        title: "Geheime Seite",
        slug: "geheim",
        type: "note",
        visibility: "dm_only",
        publishStatus: "draft",
        canonicalStatus: "canon",
        contentBlocks: [
          {
            type: "gm_note",
            sortOrder: 0,
            visibility: "dm_only",
            content: "Nur für den DM.",
          },
        ],
      },
      databaseUrl,
    );

    const context = await buildAiContext(
      repo,
      "summarize_page",
      world.id,
      publicPage.id,
      { allowDmOnly: false },
    );

    assert.equal(context.pages.length, 1);
    assert.equal(context.pages[0]?.title, "Öffentliche Seite");
    assert.ok(
      context.pages.every((page) => page.visibility !== "dm_only"),
      "dm_only pages must be excluded",
    );
    assert.ok(
      context.pages.every((page) =>
        page.contentBlocks.every((block) => block.visibility !== "dm_only"),
      ),
      "dm_only blocks must be excluded",
    );
  });

  it("includes DM-only blocks when allowDmOnly is enabled", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);

    const context = await buildAiContext(
      repo,
      "generate_dm_notes",
      seeded.world.id,
      seeded.pages.validori.id,
      { allowDmOnly: true },
    );

    const validori = context.pages.find((page) => page.pageId === seeded.pages.validori.id);
    assert.ok(validori);
    assert.ok(
      validori.contentBlocks.some((block) => block.visibility === "dm_only"),
      "expected dm_only gm_note block in Validori context",
    );
    assert.ok(contextContainsDmOnly(context));
  });
});

describe("AI Brain — privacy mode", () => {
  it("blocks cloud providers in datenschutz mode", () => {
    const context = {
      taskType: "summarize_page" as const,
      worldId: "w1",
      primaryPageId: "p1",
      pages: [],
      sources: [],
      promptContext: "",
      truncated: false,
      datenschutzMode: true,
      allowDmOnly: true,
    };

    assert.throws(
      () =>
        validateProviderForContext("openai", context, {
          datenschutzMode: true,
          localOnly: true,
        }),
      AiPrivacyError,
    );
  });

  it("blocks cloud calls with DM-only context unless explicitly allowed", () => {
    const context = {
      taskType: "summarize_page" as const,
      worldId: "w1",
      primaryPageId: "p1",
      pages: [
        {
          pageId: "p1",
          title: "Geheim",
          pageType: "note",
          tags: [],
          aliases: [],
          visibility: "dm_only",
          canonicalStatus: "canon",
          contentBlocks: [
            {
              blockId: "b1",
              type: "gm_note",
              visibility: "dm_only",
              content: "Geheimnis",
            },
          ],
          relations: [],
          backlinks: [],
        },
      ],
      sources: [{ pageId: "p1", blockIds: ["b1"] }],
      promptContext: "Geheim",
      truncated: false,
      datenschutzMode: false,
      allowDmOnly: false,
    };

    assert.throws(
      () =>
        validateProviderForContext("openai", context, {
          datenschutzMode: false,
          localOnly: false,
        }),
      AiPrivacyError,
    );

    const sanitized = sanitizeContextForCloud(context);
    assert.equal(sanitized.pages.length, 0);
  });

  it("allows local provider with DM-only context in datenschutz mode", () => {
    const context = {
      taskType: "generate_dm_notes" as const,
      worldId: "w1",
      primaryPageId: "p1",
      pages: [
        {
          pageId: "p1",
          title: "Geheim",
          pageType: "note",
          tags: [],
          aliases: [],
          visibility: "dm_only",
          canonicalStatus: "canon",
          contentBlocks: [
            {
              blockId: "b1",
              type: "gm_note",
              visibility: "dm_only",
              content: "Geheimnis",
            },
          ],
          relations: [],
          backlinks: [],
        },
      ],
      sources: [{ pageId: "p1", blockIds: ["b1"] }],
      promptContext: "Geheim",
      truncated: false,
      datenschutzMode: true,
      allowDmOnly: true,
    };

    assert.doesNotThrow(() =>
      validateProviderForContext("ollama", context, {
        datenschutzMode: true,
        localOnly: true,
      }),
    );
  });
});

describe("AI Brain — saving results", () => {
  let databaseUrl: string;

  beforeEach(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  afterEach(async () => {
    const { createPrismaClient } = await import("@uwe/database/server");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("saves AI output as idea page with canonicalStatus idea", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);

    const idea = await saveAiResultAsIdea(repo, {
      worldId: seeded.world.id,
      sourcePageId: seeded.pages.arbor.id,
      title: "Neuer Plot-Hook",
      content: "Die Feen könnten einen Pakt anbieten.",
      taskType: "create_npc",
    });

    assert.equal(idea.canonicalStatus, "idea");
    assert.notEqual(idea.canonicalStatus, "canon");
    assert.equal(idea.publishStatus, "draft");
    assert.ok(idea.contentBlocks.length > 0);
  });

  it("saves AI output as content block without promoting to canon", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const pageBefore = await repo.getPageById(seeded.pages.arbor.id);

    const block = await saveAiResultAsContentBlock(repo, {
      pageId: seeded.pages.arbor.id,
      content: "KI-Zusammenfassung der Waldregion.",
      taskType: "summarize_page",
      providerId: "ollama",
      model: "mock-model",
    });

    const pageAfter = await repo.getPageById(seeded.pages.arbor.id);

    assert.equal(block.type, "ai_summary");
    assert.equal(block.visibility, "dm_only");
    assert.equal(pageAfter?.canonicalStatus, pageBefore?.canonicalStatus);
    assert.equal((block.metadata as { isCanon?: boolean }).isCanon, false);
  });
});

describe("AI Brain — generateAiTask with mock provider", () => {
  let databaseUrl: string;

  beforeEach(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  afterEach(async () => {
    const { createPrismaClient } = await import("@uwe/database/server");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("generates text locally without cloud leak in datenschutz mode", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const apiKeyStore = new InMemoryApiKeyStore();
    apiKeyStore.set("openai", "test-key-should-not-be-used");

    const { result } = await generateAiTask(repo, {
      taskType: "summarize_page",
      worldId: seeded.world.id,
      pageId: seeded.pages.validori.id,
      providerId: "ollama",
      model: "mock-model",
      options: {
        datenschutzMode: true,
        localOnly: true,
        allowDmOnly: true,
      },
      apiKeyStore,
      useMock: true,
    });

    assert.ok(result.text.length > 0);
    assert.equal(result.provider, "ollama");
  });

  it("rejects cloud provider in datenschutz mode during generation", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);

    await assert.rejects(
      () =>
        generateAiTask(repo, {
          taskType: "summarize_page",
          worldId: seeded.world.id,
          pageId: seeded.pages.validori.id,
          providerId: "openai",
          model: "gpt-4o-mini",
          options: {
            datenschutzMode: true,
            localOnly: true,
            allowDmOnly: false,
          },
          useMock: true,
        }),
      AiPrivacyError,
    );
  });
});
