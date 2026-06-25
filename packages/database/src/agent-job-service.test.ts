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
