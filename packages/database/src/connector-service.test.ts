import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { hashConnectorToken } from "@uwe/connector";

import { createPrismaClient, type PrismaClient } from "./client";
import { createConnectorService } from "./connector-service";
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
    assert.equal(view.version, "1.2.3");
  });

  it("keeps soundboard degraded when no audio connector is online", async () => {
    const service = createConnectorService(db);
    const { connector } = await service.createConnector("No Audio Test");
    await service.heartbeat(connector.id, { capabilities: ["system_info"] });

    const summary = await service.summarize();
    assert.equal(service.capabilityAvailable(summary, "audio_local"), false);
    assert.ok(summary.availableCapabilities.includes("system_info"));
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
