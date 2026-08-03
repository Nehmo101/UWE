import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createJobService, JOB_STATUS_LABELS, JOB_TYPE_LABELS } from "./job-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("JobService", () => {
  let db: PrismaClient;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
  });

  it("exposes German labels for all job types and statuses", () => {
    assert.equal(JOB_TYPE_LABELS.ai_run, "KI-Aufgabe");
    assert.equal(JOB_STATUS_LABELS.failed, "Fehlgeschlagen");
  });

  it("enqueues, runs, completes and logs a job", async () => {
    const jobs = createJobService(db);

    const enqueued = await jobs.enqueue({
      type: "backup",
      title: "Test-Backup",
      worldSlug: "test-world",
      payload: { type: "full" },
    });

    assert.equal(enqueued.status, "pending");
    assert.equal(enqueued.canCancel, true);
    assert.equal(enqueued.canRetry, false);

    const running = await jobs.markRunning(enqueued.id);
    assert.ok(running);
    assert.equal(running!.status, "running");
    assert.equal(running!.attemptCount, 1);

    await jobs.updateProgress(enqueued.id, 50, "Daten sammeln");

    const completed = await jobs.markCompleted(enqueued.id, { filename: "test.zip" });
    assert.ok(completed);
    assert.equal(completed!.status, "completed");
    assert.equal(completed!.progress, 100);
    assert.equal(completed!.canRetry, false);

    const detail = await jobs.getById(enqueued.id, true);
    assert.ok(detail?.logs);
    assert.ok(detail!.logs!.length >= 3);
  });

  it("records failures and supports retry", async () => {
    const jobs = createJobService(db);

    const job = await jobs.enqueue({
      type: "ai_run",
      title: "KI-Test",
      payload: { taskType: "summarize_page" },
    });

    await jobs.markRunning(job.id);
    const failed = await jobs.markFailed(job.id, "Maschinenraum offline", { code: "offline" });
    assert.ok(failed);
    assert.equal(failed!.status, "failed");
    assert.equal(failed!.errorMessage, "Maschinenraum offline");
    assert.equal(failed!.canRetry, true);

    const retried = await jobs.retry(job.id);
    assert.ok(retried);
    assert.equal(retried!.status, "pending");
    assert.equal(retried!.errorMessage, null);
  });

  it("cancels pending jobs", async () => {
    const jobs = createJobService(db);

    const job = await jobs.enqueue({ type: "import", title: "Import-Test" });
    const cancelled = await jobs.markCancelled(job.id);
    assert.ok(cancelled);
    assert.equal(cancelled!.status, "cancelled");
    assert.equal(await jobs.isCancelled(job.id), true);
  });

  it("summarizes job counts", async () => {
    const jobs = createJobService(db);
    const summary = await jobs.getSummary();
    assert.equal(typeof summary.pending, "number");
    assert.equal(typeof summary.failed, "number");
    assert.ok(Array.isArray(summary.recentFailed));
  });

  it("recovers jobs interrupted by a process restart", async () => {
    const jobs = createJobService(db);

    // A job left "running" when the previous process died — orphaned, cannot resume.
    const stuck = await jobs.enqueue({ type: "backup", title: "Unterbrochenes Backup" });
    await jobs.markRunning(stuck.id);

    // A job still waiting in the queue that was never dispatched.
    const waiting = await jobs.enqueue({ type: "import", title: "Wartender Import" });

    const result = await jobs.recoverInterruptedJobs();

    // The running job is reported as failed with the restart message and retryable.
    const recovered = result.failedRunning.find((job) => job.id === stuck.id);
    assert.ok(recovered, "stuck running job should be reported as failed");
    assert.equal(recovered!.status, "failed");
    assert.equal(recovered!.errorMessage, "Prozess neu gestartet – Job abgebrochen");
    assert.equal(recovered!.canRetry, true);

    const stuckAfter = await jobs.getById(stuck.id);
    assert.equal(stuckAfter!.status, "failed");
    assert.equal(stuckAfter!.canRetry, true);

    // The pending job is returned for re-dispatch and left in "pending".
    const dispatchable = result.pendingToDispatch.find((job) => job.id === waiting.id);
    assert.ok(dispatchable, "pending job should be returned for re-dispatch");
    assert.equal(dispatchable!.status, "pending");
    assert.equal((await jobs.getById(waiting.id))!.status, "pending");

    // Idempotent: a second sweep no longer re-fails the already-failed job.
    const second = await jobs.recoverInterruptedJobs();
    assert.equal(
      second.failedRunning.some((job) => job.id === stuck.id),
      false,
    );
  });
});
