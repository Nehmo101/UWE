import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import {
  createBrainStoreService,
  createAiRunService,
  createUweRepository,
  seedTerraWorld,
} from "@uwe/database/server";
import { createGameSessionService } from "@uwe/database/server";
import {
  applyProposal,
  BRAIN_ACTION_LIST,
  buildProposalsFromResult,
  discardRun,
  getBrainAction,
  isBrainActionId,
  runBrainAction,
} from "./index";

describe("Brain Actions — catalog", () => {
  it("defines all P09 target actions plus atlas naming", () => {
    const ids = BRAIN_ACTION_LIST.map((action) => action.id);
    assert.ok(ids.includes("session_recap"));
    assert.ok(ids.includes("next_session_prep"));
    assert.ok(ids.includes("expand_knowledge"));
    assert.ok(ids.includes("create_knowledge_text"));
    assert.ok(ids.includes("canon_check"));
    assert.ok(ids.includes("player_handout"));
    assert.ok(ids.includes("fill_dungeon_room"));
    assert.ok(ids.includes("mail_draft"));
    assert.ok(ids.includes("atlas_name_regions"), "atlas_name_regions action must be present");
    assert.equal(BRAIN_ACTION_LIST.length, 9);
  });

  it("marks player-safe actions correctly", () => {
    assert.equal(getBrainAction("player_handout").playerSafe, true);
    assert.equal(getBrainAction("mail_draft").playerSafe, true);
    assert.equal(getBrainAction("session_recap").playerSafe, false);
  });

  it("validates action ids", () => {
    assert.ok(isBrainActionId("session_recap"));
    assert.ok(!isBrainActionId("unknown_action"));
  });
});

describe("Brain Actions — proposals", () => {
  it("builds mail draft proposal with subject metadata", () => {
    const action = getBrainAction("mail_draft");
    const proposals = buildProposalsFromResult({
      action,
      resultText: "Betreff: Session Recap\n\nDie Helden kehrten nach Arbor zurück.",
      sessionId: "sess-1",
    });
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]?.targetType, "mail_draft");
    assert.equal(proposals[0]?.metadata?.subject, "Session Recap");
    assert.equal(proposals[0]?.metadata?.autoSend, false);
  });

  it("builds session recap proposal for DM summary", () => {
    const action = getBrainAction("session_recap");
    const proposals = buildProposalsFromResult({
      action,
      resultText: "Die Session endete im Turm.",
      sessionId: "sess-1",
    });
    assert.equal(proposals[0]?.targetType, "session_summary_dm");
    assert.equal(proposals[0]?.visibility, "dm_only");
  });

  it("builds Wissenstext proposals as brain documents", () => {
    const action = getBrainAction("create_knowledge_text");
    const proposals = buildProposalsFromResult({
      action,
      resultText: "## Arbor\n\nArbor ist ein Waldaußenposten.",
      pageId: "page-1",
    });
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]?.targetType, "brain_document");
    assert.equal(proposals[0]?.visibility, "dm_only");
    assert.equal(proposals[0]?.metadata?.documentType, "world_knowledge");
  });
});

describe("Brain Actions — end-to-end with mock provider", () => {
  let databaseUrl: string;

  beforeEach(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  afterEach(async () => {
    const { createPrismaClient } = await import("@uwe/database/server");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("runs expand_knowledge and stores AI run with proposals", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const aiRuns = createAiRunService(databaseUrl);
    const brainStore = createBrainStoreService(databaseUrl);

    const result = await runBrainAction(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        actionId: "expand_knowledge",
        worldSlug: seeded.world.slug,
        pageSlug: seeded.pages.arbor.slug,
        providerId: "ollama",
        model: "mock-model",
        useMock: true,
        options: { allowDmOnly: true, localOnly: true },
      },
    );

    assert.ok(result.runId);
    assert.ok(result.result.text.length > 0);
    assert.ok(result.proposals.length >= 1);

    const run = await aiRuns.getById(result.runId);
    assert.ok(run);
    assert.equal(run?.status, "completed");
    assert.ok(run?.resultText);
    assert.ok(Array.isArray(run?.proposals));
  });

  it("runs create_knowledge_text and applies it as a brain document", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const aiRuns = createAiRunService(databaseUrl);
    const brainStore = createBrainStoreService(databaseUrl);

    const { runId, proposals } = await runBrainAction(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        actionId: "create_knowledge_text",
        worldSlug: seeded.world.slug,
        pageSlug: seeded.pages.arbor.slug,
        providerId: "ollama",
        model: "mock-model",
        useMock: true,
        options: { allowDmOnly: true, localOnly: true },
      },
    );

    const proposal = proposals[0];
    assert.ok(proposal);
    assert.equal(proposal.targetType, "brain_document");

    await applyProposal(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        runId,
        proposalId: proposal.id,
        editedContent: "Wissenstext über Arbor.",
      },
    );

    const documents = await brainStore.listDocuments(seeded.world.slug, {
      documentType: "world_knowledge",
    });
    const created = documents.find((doc) => doc.content === "Wissenstext über Arbor.");
    assert.ok(created);
    assert.equal(created.title, "Wissenstext");
    assert.equal(created.visibility, "dm_only");
    assert.equal(created.source, "ai_generated");
    assert.equal(created.status, "draft");
  });

  it("runs session_recap with session context and saves run history", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const sessions = createGameSessionService(databaseUrl);
    const aiRuns = createAiRunService(databaseUrl);
    const brainStore = createBrainStoreService(databaseUrl);

    const session = await sessions.create({
      worldId: seeded.world.id,
      campaignId: seeded.campaign.id,
      title: "Brain Recap Test",
      sessionNumber: 99,
      linkedPageIds: [seeded.pages.validori.id],
    });

    const result = await runBrainAction(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        actionId: "session_recap",
        worldSlug: seeded.world.slug,
        pageSlug: seeded.pages.validori.slug,
        providerId: "ollama",
        model: "mock-model",
        sessionId: session.id,
        useMock: true,
        options: { allowDmOnly: true, localOnly: true },
      },
    );

    const run = await aiRuns.getById(result.runId);
    assert.equal(run?.gameSessionId, session.id);
    assert.equal(run?.status, "completed");
  });

  it("apply and discard flow works without auto-overwrite before apply", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const aiRuns = createAiRunService(databaseUrl);
    const brainStore = createBrainStoreService(databaseUrl);
    const sessions = createGameSessionService(databaseUrl);

    const session = await sessions.create({
      worldId: seeded.world.id,
      campaignId: seeded.campaign.id,
      title: "Apply Test",
      sessionNumber: 100,
      linkedPageIds: [seeded.pages.arbor.id],
    });

    const before = await sessions.getById(session.id);
    assert.equal(before?.summaryDm, null);

    const { runId, proposals } = await runBrainAction(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        actionId: "session_recap",
        worldSlug: seeded.world.slug,
        pageSlug: seeded.pages.arbor.slug,
        providerId: "ollama",
        model: "mock-model",
        sessionId: session.id,
        useMock: true,
        options: { allowDmOnly: true, localOnly: true },
      },
    );

    const mid = await sessions.getById(session.id);
    assert.equal(mid?.summaryDm, null, "must not auto-apply before review");

    const proposal = proposals[0];
    assert.ok(proposal);

    await applyProposal(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        runId,
        proposalId: proposal.id,
        editedContent: "Übernommenes Session-Recap.",
      },
    );

    const after = await sessions.getById(session.id);
    assert.equal(after?.summaryDm, "Übernommenes Session-Recap.");

    const appliedRun = await aiRuns.getById(runId);
    assert.equal(appliedRun?.status, "applied");
  });

  it("discard marks run as discarded", async () => {
    const repo = createUweRepository(databaseUrl);
    const seeded = await seedTerraWorld(repo);
    const aiRuns = createAiRunService(databaseUrl);
    const brainStore = createBrainStoreService(databaseUrl);

    const { runId } = await runBrainAction(
      { repo, aiRuns, brainStore, databaseUrl },
      {
        actionId: "canon_check",
        worldSlug: seeded.world.slug,
        pageSlug: seeded.pages.validori.slug,
        providerId: "ollama",
        model: "mock-model",
        useMock: true,
        options: { allowDmOnly: true, localOnly: true },
      },
    );

    await discardRun({ repo, aiRuns, brainStore, databaseUrl }, runId);
    const run = await aiRuns.getById(runId);
    assert.equal(run?.status, "discarded");
  });
});
