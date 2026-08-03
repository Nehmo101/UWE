import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import {
  createUweRepository,
  seedTerraWorld,
} from "@uwe/database/server";
import { createGameSessionService } from "@uwe/database/server";
import {
  buildAiContext,
  generateAiTask,
  InMemoryApiKeyStore,
  saveAiResultAsContentBlock,
  saveAiResultAsIdea,
  saveAiResultAsPlayerRecap,
} from "./index";

const GM_SECRET_PHRASE = "Geheime Information: Unter Arbor schlummert ein Portal";

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
    assert.ok(context.debug);
  });

  it("includes session context for summarize_session", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const sessions = createGameSessionService(databaseUrl);

    const session = await sessions.create({
      worldId: seeded.world.id,
      campaignId: seeded.campaign.id,
      title: "Testsession",
      sessionNumber: 1,
      summaryDm: "DM wusste vom Portal.",
      notes: "Spieler trafen Validori.",
      linkedPageIds: [seeded.pages.validori.id],
    });

    const context = await buildAiContext(
      repo,
      "summarize_session",
      seeded.world.id,
      seeded.pages.validori.id,
      { sessionId: session.id },
    );

    assert.equal(context.sessionId, session.id);
    assert.ok(context.session);
    assert.ok(context.promptContext.includes("Testsession"));
    assert.ok(context.promptContext.includes("DM wusste vom Portal"));
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
      sources: [{ pageId: seeded.pages.arbor.id, blockIds: ["block-1"] }],
      providerId: "ollama",
      model: "mock-model",
    });

    assert.equal(idea.canonicalStatus, "idea");
    assert.notEqual(idea.canonicalStatus, "canon");
    assert.ok(idea.contentBlocks.length > 0);

    const metadata = idea.contentBlocks[0]?.metadata as {
      contextSources?: Array<{ pageId: string }>;
      isCanon?: boolean;
    };
    assert.equal(metadata.isCanon, false);
    assert.ok(metadata.contextSources?.some((s) => s.pageId === seeded.pages.arbor.id));
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
      sources: [{ pageId: seeded.pages.arbor.id, blockIds: ["b1", "b2"] }],
    });

    const pageAfter = await repo.getPageById(seeded.pages.arbor.id);

    assert.equal(block.type, "ai_summary");
    assert.equal(pageAfter?.canonicalStatus, pageBefore?.canonicalStatus);
    const metadata = block.metadata as {
      isCanon?: boolean;
      contextSources?: Array<{ pageId: string; blockIds?: string[] }>;
    };
    assert.equal(metadata.isCanon, false);
    assert.equal(metadata.contextSources?.[0]?.pageId, seeded.pages.arbor.id);
    assert.deepEqual(metadata.contextSources?.[0]?.blockIds, ["b1", "b2"]);
  });

  it("saves player recap without GM secrets", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const sessions = createGameSessionService(databaseUrl);

    const session = await sessions.create({
      worldId: seeded.world.id,
      campaignId: seeded.campaign.id,
      title: "Recap-Session",
      sessionNumber: 2,
      linkedPageIds: [seeded.pages.arbor.id],
    });

    const playerRecap =
      "Die Helden erkundeten den Wald Arbor und trafen freundliche Feen am Waldrand.";

    const saved = await saveAiResultAsPlayerRecap(repo, {
      sessionId: session.id,
      content: playerRecap,
      taskType: "generate_player_recap",
      providerId: "ollama",
      model: "mock-model",
      sources: [{ pageId: seeded.pages.arbor.id, blockIds: [] }],
      sourcePageId: seeded.pages.arbor.id,
    });

    assert.equal(saved.session.summaryPlayer, playerRecap);
    assert.ok(!saved.session.summaryPlayer?.includes(GM_SECRET_PHRASE));
    assert.ok(saved.metadata.contextSources?.some((s) => s.pageId === seeded.pages.arbor.id));
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
    const { createAiGatewayService, createPrismaClient } = await import("@uwe/database/server");
    const db = createPrismaClient(databaseUrl);
    const gateway = createAiGatewayService(db);

    const { result } = await generateAiTask(repo, {
      taskType: "summarize_page",
      worldId: seeded.world.id,
      pageId: seeded.pages.validori.id,
      providerId: "ollama",
      model: "mock-model",
      options: {
        datenschutzMode: true,
        localOnly: true,
      },
      apiKeyStore,
      useMock: true,
      prisma: db,
      gatewayService: gateway,
    });

    assert.ok(result.text.length > 0);
    assert.ok(result.text.length > 0);
  });

  it("no longer rejects a legacy cloud provider id — everything lands on the Maschinenraum host", async () => {
    // Cloud providers were removed. A stored request that still names one must
    // not blow up; it simply routes locally like every other request.
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const { createAiGatewayService, createPrismaClient } = await import("@uwe/database/server");
    const db = createPrismaClient(databaseUrl);
    const gateway = createAiGatewayService(db);

    await assert.doesNotReject(() =>
      generateAiTask(repo, {
        taskType: "summarize_page",
        worldId: seeded.world.id,
        pageId: seeded.pages.validori.id,
        providerId: "openai",
        options: {
          datenschutzMode: true,
          localOnly: true,
        },
        apiKeyStore: new InMemoryApiKeyStore(),
        useMock: true,
        prisma: db,
        gatewayService: gateway,
      }),
    );
  });

  it("forces local routing when gateway routing is LOCAL_ONLY even for cloud provider", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const apiKeyStore = new InMemoryApiKeyStore();
    apiKeyStore.set("openai", "test-openai-key");
    const { createAiGatewayService, createPrismaClient } = await import("@uwe/database/server");
    const db = createPrismaClient(databaseUrl);
    const gateway = createAiGatewayService(db);
    await gateway.updateConfig({ routingMode: "LOCAL_ONLY" });

    const { result } = await generateAiTask(repo, {
      taskType: "summarize_page",
      worldId: seeded.world.id,
      pageId: seeded.pages.validori.id,
      providerId: "openai",
      model: "mock-model",
      options: {
        datenschutzMode: false,
        localOnly: true,
      },
      apiKeyStore,
      useMock: true,
      prisma: db,
      gatewayService: gateway,
    });

    assert.equal(result.provider, "ollama");
  });
});
