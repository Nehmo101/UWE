import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createDevAgentJobService } from "./agent-job-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("DevAgentJobService.applyCompletionCallback", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("marks a running job completed with prUrl", async () => {
    const service = createDevAgentJobService(db);

    const created = await service.createJob({
      title: "feat: callback test",
      prompt: "Implement callback handling",
      provider: "github_actions",
    });

    await service.updateJob(created.id, {
      status: "running",
      branchName: "cursor/callback-test",
    });

    const completed = await service.applyCompletionCallback(created.id, {
      status: "completed",
      prUrl: "https://github.com/acme/repo/pull/99",
      branchName: "cursor/callback-test",
    });

    assert.equal(completed.status, "completed");
    assert.equal(completed.prUrl, "https://github.com/acme/repo/pull/99");
    assert.ok(completed.completedAt);

    await db.devAgentJob.delete({ where: { id: created.id } });
  });

  it("does not overwrite an already completed job", async () => {
    const service = createDevAgentJobService(db);

    const created = await service.createJob({
      title: "feat: idempotent callback",
      prompt: "Keep first completion",
      provider: "github_actions",
    });

    await service.applyCompletionCallback(created.id, {
      status: "completed",
      prUrl: "https://github.com/acme/repo/pull/1",
    });

    const second = await service.applyCompletionCallback(created.id, {
      status: "failed",
      errorMessage: "late failure",
    });

    assert.equal(second.status, "completed");
    assert.equal(second.prUrl, "https://github.com/acme/repo/pull/1");

    await db.devAgentJob.delete({ where: { id: created.id } });
  });
});

describe("DevAgentJobService.applyCursorPollResult", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("keeps a running job open and records cursor metadata", async () => {
    const service = createDevAgentJobService(db);
    const created = await service.createJob({
      title: "feat: cursor poll running",
      prompt: "do it",
      provider: "cursor_cloud",
    });

    const polled = await service.applyCursorPollResult(created.id, {
      status: "running",
      rawStatus: "RUNNING",
      branchName: "cursor/x",
      url: "https://cursor.com/agents?id=bc_1",
      summary: "working",
    });

    assert.equal(polled.status, "running");
    assert.equal(polled.branchName, "cursor/x");
    assert.equal(polled.completedAt, null);
    const result = polled.result as { cursor?: { status?: string; summary?: string } };
    assert.equal(result.cursor?.status, "RUNNING");
    assert.equal(result.cursor?.summary, "working");

    await db.devAgentJob.delete({ where: { id: created.id } });
  });

  it("marks a finished agent completed and a failed agent failed", async () => {
    const service = createDevAgentJobService(db);

    const ok = await service.createJob({ title: "done", prompt: "x", provider: "cursor_cloud" });
    const completed = await service.applyCursorPollResult(ok.id, {
      status: "completed",
      rawStatus: "FINISHED",
      prUrl: "https://github.com/acme/repo/pull/5",
    });
    assert.equal(completed.status, "completed");
    assert.ok(completed.completedAt);
    assert.equal(completed.errorMessage, null);

    const bad = await service.createJob({ title: "bad", prompt: "x", provider: "cursor_cloud" });
    const failed = await service.applyCursorPollResult(bad.id, {
      status: "failed",
      rawStatus: "ERROR",
    });
    assert.equal(failed.status, "failed");
    assert.ok(failed.completedAt);
    assert.match(failed.errorMessage ?? "", /Cursor Agent/);

    await db.devAgentJob.delete({ where: { id: ok.id } });
    await db.devAgentJob.delete({ where: { id: bad.id } });
  });
});
