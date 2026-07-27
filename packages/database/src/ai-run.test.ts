import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAiRunService } from "./ai-run-service";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

describe("UWE AI Run History", () => {
  let databaseUrl: string;
  let worldId: string;
  let pageId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({
      name: "AI Run Test World",
      slug: "ai-run-test",
      description: "AI run tests",
    });
    worldId = world.id;

    const page = await repo.createPage({
      worldId: world.id,
      title: "Test Page",
      slug: "test-page",
      type: "lore",
    });
    pageId = page.id;
  });

  after(async () => {
    const db = createPrismaClient(databaseUrl);
    await db.$disconnect();
  });

  it("creates, completes and lists AI runs", async () => {
    const runs = createAiRunService(databaseUrl);

    const pending = await runs.create({
      worldId,
      pageId,
      source: "test",
      taskType: "summarize_page",
      provider: "ollama",
      model: "mock-model",
      userPrompt: "Summarize this",
      targetType: "page",
      targetId: pageId,
    });

    assert.equal(pending.status, "pending");
    assert.equal(pending.taskType, "summarize_page");

    const running = await runs.markRunning(pending.id);
    assert.equal(running.status, "running");

    const completed = await runs.markCompleted(pending.id, {
      resultText: "Summary text",
      resultMeta: { finishReason: "stop" },
      contextData: { promptContext: "context snippet", pages: [] },
      systemPrompt: "You are helpful",
      userPrompt: "Summarize this",
      durationMs: 120,
    });

    assert.equal(completed.status, "completed");
    assert.equal(completed.resultText, "Summary text");
    assert.equal(completed.durationMs, 120);

    const { runs: listed, total } = await runs.list({ worldId, limit: 10 });
    assert.equal(total, 1);
    assert.equal(listed[0].id, pending.id);
  });

  it("marks runs as failed, applied and discarded", async () => {
    const runs = createAiRunService(databaseUrl);

    const failedRun = await runs.create({
      worldId,
      pageId,
      taskType: "summarize_page",
      provider: "ollama",
      model: "mock-model",
    });
    const failed = await runs.markFailed(failedRun.id, {
      errorMessage: "Provider offline",
      errorDetails: { code: "offline" },
      durationMs: 50,
    });
    assert.equal(failed.status, "failed");
    assert.equal(failed.errorMessage, "Provider offline");

    const reviewRun = await runs.create({
      worldId,
      pageId,
      taskType: "improve_lore_text",
      provider: "ollama",
      model: "mock-model",
    });
    await runs.markCompleted(reviewRun.id, { resultText: "Improved text" });

    const applied = await runs.markApplied(reviewRun.id);
    assert.equal(applied.status, "applied");
    assert.ok(applied.appliedAt);

    const discardRun = await runs.create({
      worldId,
      pageId,
      taskType: "summarize_page",
      provider: "ollama",
      model: "mock-model",
    });
    await runs.markCompleted(discardRun.id, { resultText: "Discard me" });
    const discarded = await runs.markDiscarded(discardRun.id);
    assert.equal(discarded.status, "discarded");
    assert.ok(discarded.discardedAt);
  });

  it("returns latest run for world", async () => {
    const runs = createAiRunService(databaseUrl);
    const latest = await runs.getLatestForWorld(worldId);
    assert.ok(latest);
    assert.equal(latest.worldId, worldId);
  });
});
