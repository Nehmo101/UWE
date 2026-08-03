/**
 * Host-side connector smoke — simulates the Worker ↔ Host cycle without a live
 * Maschinenraum process. Satisfies audit Kurzfrist #3 (CI-enqueue/claim/complete path).
 */

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createPrismaClient, type PrismaClient } from "./client";
import {
  createConnectorService,
  waitForConnectorJob,
} from "./connector-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("connector host smoke (Worker ↔ Host cycle)", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("registers connector, heartbeats, enqueues llm_generate, claims and completes", async () => {
    const service = createConnectorService(db);
    const { connector, token } = await service.createConnector("Smoke Maschinenraum");
    assert.ok(token.startsWith("uwec_"));

    const heartbeat = await service.heartbeat(connector.id, {
      capabilities: ["llm_local", "embedding_local"],
      version: "smoke-test",
      queueEnabled: true,
    });
    assert.equal(heartbeat.status, "online");
    assert.ok(heartbeat.capabilities.includes("llm_local"));

    const job = await service.enqueueJob({
      type: "llm_generate",
      payload: { prompt: "Smoke test", model: "llama3.2" },
    });
    assert.equal(job.status, "pending");

    const claimed = await service.claimJob({
      connectorId: connector.id,
      availableLanes: ["gpu"],
    });
    assert.equal(claimed?.id, job.id);
    assert.equal(claimed?.type, "llm_generate");

    await service.completeJob(job.id, connector.id, {
      text: "Smoke OK",
      model: "llama3.2",
      provider: "ollama",
    });

    const completed = await waitForConnectorJob(db, job.id, { intervalMs: 1 });
    assert.equal(completed.status, "completed");
    assert.deepEqual(completed.result, {
      text: "Smoke OK",
      model: "llama3.2",
      provider: "ollama",
    });
  });

  it("honours host allowedCapabilities during the smoke path", async () => {
    const service = createConnectorService(db);
    const { connector } = await service.createConnector("Smoke Policy");
    await service.heartbeat(connector.id, {
      capabilities: ["llm_local", "audio_local"],
    });
    await service.setAllowedCapabilities(connector.id, ["audio_local"]);

    await service.enqueueJob({ type: "llm_generate", payload: { prompt: "blocked" } });
    const blocked = await service.claimJob({
      connectorId: connector.id,
      availableLanes: ["gpu", "audio"],
    });
    assert.equal(blocked, null);

    const audioJob = await service.enqueueJob({
      type: "sound_play",
      payload: { sourceUrl: "test.mp3" },
    });
    const claimed = await service.claimJob({
      connectorId: connector.id,
      availableLanes: ["audio"],
    });
    assert.equal(claimed?.id, audioJob.id);

    await service.completeJob(audioJob.id, connector.id, { dispatched: true });
    const done = await waitForConnectorJob(db, audioJob.id, { intervalMs: 1 });
    assert.equal(done.status, "completed");
  });
});
