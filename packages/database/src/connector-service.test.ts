import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { hashConnectorToken } from "@uwe/connector";

import { createPrismaClient, type PrismaClient } from "./client";
import {
  ConnectorJobWaitError,
  createConnectorService,
  waitForConnectorJob,
} from "./connector-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("ConnectorService", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("creates a connector and stores only the token hash", async () => {
    const service = createConnectorService(db);
    const { connector, token } = await service.createConnector("RTX Laptop");

    assert.ok(token.startsWith("uwec_"));
    const row = await db.connector.findUnique({ where: { id: connector.id } });
    assert.ok(row);
    assert.notEqual(row.tokenHash, token, "plaintext token must not be stored");
    assert.equal(row.tokenHash, hashConnectorToken(token));
    assert.equal(connector.status, "offline");
  });

  it("authenticates with the raw token and rejects wrong tokens", async () => {
    const service = createConnectorService(db);
    const { connector, token } = await service.createConnector("Auth Test");

    const authed = await service.authenticate(token);
    assert.equal(authed?.id, connector.id);
    assert.equal(await service.authenticate("uwec_wrong"), null);
    assert.equal(await service.authenticate(""), null);
  });

  it("records heartbeats, capabilities and derives online status", async () => {
    const service = createConnectorService(db);
    const { connector } = await service.createConnector("HB Test");

    const view = await service.heartbeat(connector.id, {
      capabilities: ["audio_local", "llm_local", "not_a_capability"],
      version: "1.2.3",
      currentJobs: 0,
    });
    assert.equal(view.status, "online");
    assert.deepEqual(view.capabilities, ["audio_local", "llm_local"]);
    assert.deepEqual(view.reportedCapabilities, ["audio_local", "llm_local"]);
    assert.equal(view.allowedCapabilities, null);
    assert.equal(view.version, "1.2.3");
  });

  it("keeps soundboard degraded when no audio connector is online", async () => {
    const isolatedDb = createPrismaClient(createTestDatabaseUrl());
    const service = createConnectorService(isolatedDb);
    const { connector } = await service.createConnector("No Audio Test");
    await service.heartbeat(connector.id, { capabilities: ["system_info"] });

    const summary = await service.summarize();
    assert.equal(service.capabilityAvailable(summary, "audio_local"), false);
    assert.deepEqual(summary.availableCapabilities, ["system_info"]);
  });

  it("does not let unknown reported capabilities unlock jobs", async () => {
    const service = createConnectorService(db);
    const { connector } = await service.createConnector("Unknown Caps Test");
    await service.heartbeat(connector.id, { capabilities: ["not_a_capability"] });

    const row = await db.connector.findUnique({ where: { id: connector.id } });
    assert.deepEqual(row?.capabilities, []);

    await db.connectorJob.create({
      data: {
        type: "sound_play",
        lane: "audio",
        priority: 90,
        targetCapability: "not_a_capability",
        payload: {},
      },
    });

    const claimed = await service.claimJob({
      connectorId: connector.id,
      availableLanes: ["audio"],
    });
    assert.equal(claimed, null);
  });

  it("applies host allowedCapabilities as the effective claim policy", async () => {
    const isolatedDb = createPrismaClient(createTestDatabaseUrl());
    const service = createConnectorService(isolatedDb);
    const { connector } = await service.createConnector("Allowed Caps Test");

    await service.setAllowedCapabilities(connector.id, ["audio_local"]);
    const view = await service.heartbeat(connector.id, {
      capabilities: ["audio_local", "llm_local"],
    });

    assert.deepEqual(view.reportedCapabilities, ["audio_local", "llm_local"]);
    assert.deepEqual(view.allowedCapabilities, ["audio_local"]);
    assert.deepEqual(view.capabilities, ["audio_local"]);

    await service.enqueueJob({ type: "llm_generate", payload: { prompt: "hi" } });
    await service.enqueueJob({ type: "sound_play", payload: { sourceUrl: "x" } });

    const audio = await service.claimJob({
      connectorId: connector.id,
      availableLanes: ["audio", "gpu"],
    });
    assert.equal(audio?.type, "sound_play");

    const blocked = await service.claimJob({
      connectorId: connector.id,
      availableLanes: ["gpu"],
    });
    assert.equal(blocked, null);
  });

  it("treats an empty allowedCapabilities list as deny-all", async () => {
    const isolatedDb = createPrismaClient(createTestDatabaseUrl());
    const service = createConnectorService(isolatedDb);
    const { connector } = await service.createConnector("Deny Caps Test");

    await service.setAllowedCapabilities(connector.id, []);
    const view = await service.heartbeat(connector.id, { capabilities: ["audio_local"] });

    assert.deepEqual(view.reportedCapabilities, ["audio_local"]);
    assert.deepEqual(view.allowedCapabilities, []);
    assert.deepEqual(view.capabilities, []);

    await service.enqueueJob({ type: "sound_play", payload: { sourceUrl: "x" } });
    const claimed = await service.claimJob({ connectorId: connector.id, availableLanes: ["audio"] });
    assert.equal(claimed, null);
  });

  it("claims the highest-priority job matching capabilities", async () => {
    const service = createConnectorService(db);
    const { connector } = await service.createConnector("Claim Test");
    await service.heartbeat(connector.id, { capabilities: ["audio_local", "llm_local"] });

    const llm = await service.enqueueJob({ type: "llm_generate", payload: { prompt: "hi" } });
    await service.enqueueJob({ type: "sound_play", payload: { sourceUrl: "x" } });

    // audio + gpu lanes free -> sound_play (priority 90) beats llm_generate (50)
    const claimed = await service.claimJob({
      connectorId: connector.id,
      availableLanes: ["audio", "gpu"],
    });
    assert.equal(claimed?.type, "sound_play");
    assert.equal(claimed?.status, "claimed");
    assert.equal(claimed?.claimedByConnectorId, connector.id);

    // only gpu lane free now -> llm_generate is claimable
    const second = await service.claimJob({
      connectorId: connector.id,
      availableLanes: ["gpu"],
    });
    assert.equal(second?.id, llm.id);
  });

  it("does not claim jobs requiring missing capabilities", async () => {
    const service = createConnectorService(db);
    const { connector } = await service.createConnector("Caps Test");
    await service.heartbeat(connector.id, { capabilities: ["audio_local"] });

    await service.enqueueJob({ type: "image_generate", payload: {} });
    const claimed = await service.claimJob({
      connectorId: connector.id,
      availableLanes: ["audio", "gpu"],
    });
    assert.equal(claimed, null);
  });

  it("completes and fails jobs (with retry then terminal failure)", async () => {
    const service = createConnectorService(db);
    const { connector } = await service.createConnector("Complete Test");
    await service.heartbeat(connector.id, { capabilities: ["audio_local"] });

    const job = await service.enqueueJob({ type: "sound_play", payload: {} });
    const claimed = await service.claimJob({
      connectorId: connector.id,
      availableLanes: ["audio"],
    });
    assert.equal(claimed?.id, job.id);

    const completed = await service.completeJob(job.id, connector.id, { played: true });
    assert.equal(completed?.status, "completed");

    // retry path
    const retryable = await service.enqueueJob({ type: "sound_play", payload: {}, maxRetries: 1 });
    await service.claimJob({ connectorId: connector.id, availableLanes: ["audio"] });
    const requeued = await service.failJob(retryable.id, connector.id, "transient");
    assert.equal(requeued?.status, "pending", "retries remaining -> back to pending");
    assert.equal(requeued?.retryCount, 1);

    await service.claimJob({ connectorId: connector.id, availableLanes: ["audio"] });
    const failed = await service.failJob(retryable.id, connector.id, "permanent");
    assert.equal(failed?.status, "failed");
  });

  it("expires jobs past their expiry", async () => {
    const service = createConnectorService(db);
    const job = await service.enqueueJob({
      type: "sound_play",
      payload: {},
      expiresAt: new Date(Date.now() - 1000),
    });
    const count = await service.expireStaleJobs();
    assert.ok(count >= 1);
    const row = await db.connectorJob.findUnique({ where: { id: job.id } });
    assert.equal(row?.status, "expired");
  });
});

describe("waitForConnectorJob", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("resolves with the job once it completes", async () => {
    const service = createConnectorService(db);
    const { connector } = await service.createConnector("Wait Complete");
    await service.heartbeat(connector.id, { capabilities: ["llm_local"] });

    const job = await service.enqueueJob({ type: "llm_generate", payload: { prompt: "hi" } });
    await service.claimJob({ connectorId: connector.id, availableLanes: ["gpu"] });
    await service.completeJob(job.id, connector.id, { text: "Hallo", model: "llama3.2" });

    const completed = await waitForConnectorJob(db, job.id, { intervalMs: 1 });
    assert.equal(completed.status, "completed");
    assert.deepEqual(completed.result, { text: "Hallo", model: "llama3.2" });
  });

  it("polls until a job reaches a terminal state", async () => {
    const service = createConnectorService(db);
    const { connector } = await service.createConnector("Wait Poll");
    await service.heartbeat(connector.id, { capabilities: ["llm_local"] });

    const job = await service.enqueueJob({ type: "llm_generate", payload: { prompt: "hi" } });

    const waitPromise = waitForConnectorJob(db, job.id, { intervalMs: 5 });
    await service.claimJob({ connectorId: connector.id, availableLanes: ["gpu"] });
    await service.completeJob(job.id, connector.id, { text: "späte Antwort" });

    const completed = await waitPromise;
    assert.equal(completed.status, "completed");
  });

  it("throws when the job fails", async () => {
    const service = createConnectorService(db);
    const { connector } = await service.createConnector("Wait Fail");
    await service.heartbeat(connector.id, { capabilities: ["llm_local"] });

    const job = await service.enqueueJob({ type: "llm_generate", payload: { prompt: "hi" } });
    await service.claimJob({ connectorId: connector.id, availableLanes: ["gpu"] });
    await service.failJob(job.id, connector.id, "OOM auf der GPU");

    await assert.rejects(
      () => waitForConnectorJob(db, job.id, { intervalMs: 1 }),
      (error: unknown) => {
        assert.ok(error instanceof ConnectorJobWaitError);
        assert.equal(error.status, "failed");
        assert.match(error.message, /OOM/);
        return true;
      },
    );
  });

  it("throws for a missing job", async () => {
    await assert.rejects(
      () => waitForConnectorJob(db, "does-not-exist", { intervalMs: 1 }),
      (error: unknown) => error instanceof ConnectorJobWaitError && error.status === "missing",
    );
  });

  it("throws on timeout using injected clock/sleep", async () => {
    const service = createConnectorService(db);
    const job = await service.enqueueJob({ type: "llm_generate", payload: { prompt: "hi" } });

    let clock = 0;
    let sleeps = 0;
    await assert.rejects(
      () =>
        waitForConnectorJob(db, job.id, {
          timeoutMs: 50,
          intervalMs: 10,
          now: () => clock,
          sleep: async (ms) => {
            sleeps += 1;
            clock += ms;
          },
        }),
      (error: unknown) => error instanceof ConnectorJobWaitError && error.status === "timeout",
    );
    assert.ok(sleeps >= 1, "should have polled at least once before timing out");
  });
});
