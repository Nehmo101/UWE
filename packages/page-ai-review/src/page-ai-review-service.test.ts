import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { combineBlockContent, createPrismaClient, type PrismaClient } from "@uwe/database/server";
import { createUweRepository, type UweRepository } from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { createAiReviewService } from "@uwe/database/server";
import { createPageAiReviewService } from "../src/page-ai-review-service";
import { parseSuggestedTags } from "../src/types";

describe("PageAiReviewService", () => {
  let db: PrismaClient;
  let repo: UweRepository;
  let worldSlug: string;
  let pageId: string;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    repo = createUweRepository(databaseUrl);

    const world = await repo.createWorld({ name: "Review World", slug: "review-world" });
    worldSlug = world.slug;

    const page = await repo.createPage({
      worldId: world.id,
      title: "Session Notiz",
      slug: "session-notiz",
      type: "session",
      visibility: "dm_only",
      publishStatus: "draft",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, visibility: "dm_only", content: "Roher Sessiontext." },
      ],
    });
    pageId = page.id;
  });

  it("parseSuggestedTags reads JSON tag lists", () => {
    assert.deepEqual(parseSuggestedTags('{"tags":["npc","session"]}'), ["npc", "session"]);
  });

  it("onProposalReady moves page to review status", async () => {
    const review = createAiReviewService(db);
    const pageAiReview = createPageAiReviewService(db);
    const page = await repo.getPageById(pageId);
    assert.ok(page);

    const run = await db.aiRun.create({
      data: {
        worldId: page!.worldId,
        pageId,
        taskType: "improve_lore_text",
        provider: "ollama",
        model: "mock",
        status: "completed",
        resultText: "Formatierter Sessiontext.",
      },
    });

    const { proposal } = await review.createProposalFromRun({
      aiRunId: run.id,
      worldId: page!.worldId,
      pageId,
      taskType: "improve_lore_text",
      resultText: "Formatierter Sessiontext.",
      originalContent: combineBlockContent(page!.contentBlocks),
      previousPublishStatus: "draft",
    });

    await pageAiReview.onProposalReady(proposal.id);

    const updated = await db.page.findUnique({ where: { id: pageId } });
    assert.equal(updated?.publishStatus, "review");

    const refreshed = await review.getProposal(proposal.id);
    assert.equal(refreshed?.suggestedMode, "replace_content");
    assert.equal(refreshed?.patch.payload.originalContent, "Roher Sessiontext.");
  });

  it("acceptReview applies content and sets aiReviewedAt", async () => {
    const pageAiReview = createPageAiReviewService(db);
    const pending = await db.aiProposal.findFirst({
      where: { sourcePageId: pageId, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(pending);

    const accepted = await pageAiReview.acceptReview(
      pending!.id,
      "Finaler Sessiontext nach Review.",
    );
    assert.equal(accepted.ok, true);

    const page = await repo.getPageById(pageId);
    assert.ok(page);
    assert.equal(page!.publishStatus, "draft");
    assert.ok(page!.aiReviewedAt);
    assert.equal(combineBlockContent(page!.contentBlocks), "Finaler Sessiontext nach Review.");
  });

  it("listReviewPages is empty after accept", async () => {
    const pageAiReview = createPageAiReviewService(db);
    const items = await pageAiReview.listReviewPages(worldSlug);
    assert.equal(items.length, 0);
  });
});
