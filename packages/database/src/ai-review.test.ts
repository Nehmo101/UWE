import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createActivityLogService } from "./activity-log-service";
import { createAiReviewService } from "./ai-review-service";
import { createPrismaClient, type PrismaClient } from "./client";
import { createUweRepository, type UweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUndoService } from "./undo-service";

describe("AI review / apply / undo", () => {
  let db: PrismaClient;
  let repo: UweRepository;
  let review: ReturnType<typeof createAiReviewService>;
  let undo: ReturnType<typeof createUndoService>;
  let activity: ReturnType<typeof createActivityLogService>;
  let worldId: string;
  let worldSlug: string;
  let pageId: string;
  let sessionId: string;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    repo = createUweRepository(databaseUrl);
    review = createAiReviewService(db);
    undo = createUndoService(db);
    activity = createActivityLogService(db);

    const world = await repo.createWorld({ name: "Brain Review", slug: "brain-review" });
    worldId = world.id;
    worldSlug = world.slug;

    const page = await repo.createPage({
      worldId,
      title: "Quellseite",
      slug: "quellseite",
      type: "lore",
      visibility: "dm_only",
      publishStatus: "draft",
    });
    pageId = page.id;

    const session = await db.gameSession.create({
      data: {
        worldId,
        title: "Session 1",
        sessionNumber: 1,
        status: "played",
        summaryPlayer: "Alter Recap",
      },
    });
    sessionId = session.id;
  });

  it("stores generation as pending proposal without touching productive data", async () => {
    const run = await db.aiRun.create({
      data: {
        worldId,
        pageId,
        taskType: "summarize_page",
        provider: "ollama",
        model: "mock",
        status: "completed",
        resultText: "Zusammenfassung als Vorschlag",
      },
    });

    const { runId, proposal } = await review.createProposalFromRun({
      aiRunId: run.id,
      worldId,
      pageId,
      taskType: "summarize_page",
      resultText: "Zusammenfassung als Vorschlag",
    });

    assert.ok(runId);
    assert.equal(proposal.status, "pending");
    assert.equal(proposal.suggestedMode, "content_block");
    assert.equal(proposal.patch.allowedModes.includes("content_block"), true);

    const blocksBefore = await db.contentBlock.count({ where: { pageId } });
    assert.equal(blocksBefore, 0);
  });

  it("applies content_block explicitly with undo snapshot and audit log", async () => {
    const run = await db.aiRun.create({
      data: {
        worldId,
        pageId,
        taskType: "summarize_page",
        provider: "ollama",
        model: "mock",
        status: "completed",
        resultText: "Übernommener Block-Text",
      },
    });

    const { proposal } = await review.createProposalFromRun({
      aiRunId: run.id,
      worldId,
      pageId,
      taskType: "summarize_page",
      resultText: "Übernommener Block-Text",
    });

    const result = await review.applyProposal(proposal.id, { mode: "content_block" });
    assert.equal(result.ok, true);
    assert.ok(result.undoEntryId);

    const blocks = await db.contentBlock.findMany({ where: { pageId } });
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].content, "Übernommener Block-Text");

    const logs = await db.aiApplyLog.findMany({ where: { proposalId: proposal.id } });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, "apply");

    const activityEntries = await activity.list({ worldId, actions: ["ai_proposal_applied"] });
    assert.ok(activityEntries.some((entry) => entry.targetId === proposal.id));

    const undoResult = await undo.undo(result.undoEntryId!);
    assert.equal(undoResult.ok, true);
    assert.equal(await db.contentBlock.count({ where: { pageId } }), 0);
  });

  it("discards a pending proposal without writing data", async () => {
    const run = await db.aiRun.create({
      data: {
        worldId,
        pageId,
        taskType: "create_npc",
        provider: "ollama",
        model: "mock",
        status: "completed",
        resultText: "NPC Entwurf",
      },
    });

    const { proposal } = await review.createProposalFromRun({
      aiRunId: run.id,
      worldId,
      pageId,
      taskType: "create_npc",
      resultText: "NPC Entwurf",
    });

    const result = await review.discardProposal(proposal.id);
    assert.equal(result.ok, true);

    const refreshed = await review.getProposal(proposal.id);
    assert.equal(refreshed?.status, "discarded");

    const pages = await db.page.count({
      where: { worldId, canonicalStatus: "idea" },
    });
    assert.equal(pages, 0);

    const activityEntries = await activity.list({ worldId, actions: ["ai_proposal_discarded"] });
    assert.ok(activityEntries.some((entry) => entry.targetId === proposal.id));
  });

  it("applies player recap with session undo", async () => {
    const run = await db.aiRun.create({
      data: {
        worldId,
        pageId,
        gameSessionId: sessionId,
        taskType: "generate_player_recap",
        provider: "ollama",
        model: "mock",
        status: "completed",
        resultText: "Neuer Spieler-Recap",
      },
    });

    const { proposal } = await review.createProposalFromRun({
      aiRunId: run.id,
      worldId,
      pageId,
      sessionId,
      taskType: "generate_player_recap",
      resultText: "Neuer Spieler-Recap",
    });

    const result = await review.applyProposal(proposal.id, {
      mode: "player_recap",
      sessionId,
    });
    assert.equal(result.ok, true);

    const session = await db.gameSession.findUnique({ where: { id: sessionId } });
    assert.equal(session?.summaryPlayer, "Neuer Spieler-Recap");

    const undoResult = await undo.undo(result.undoEntryId!);
    assert.equal(undoResult.ok, true);

    const restored = await db.gameSession.findUnique({ where: { id: sessionId } });
    assert.equal(restored?.summaryPlayer, "Alter Recap");
  });

  it("refuses apply on already discarded proposals", async () => {
    const run = await db.aiRun.create({
      data: {
        worldId,
        pageId,
        taskType: "summarize_page",
        provider: "ollama",
        model: "mock",
        status: "completed",
        resultText: "Verworfen",
      },
    });

    const { proposal } = await review.createProposalFromRun({
      aiRunId: run.id,
      worldId,
      pageId,
      taskType: "summarize_page",
      resultText: "Verworfen",
    });

    await review.discardProposal(proposal.id);
    const result = await review.applyProposal(proposal.id, { mode: "content_block" });
    assert.equal(result.ok, false);
  });
});
