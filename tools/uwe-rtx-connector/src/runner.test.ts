import assert from "node:assert/strict";
import { test } from "node:test";

import type { ConnectorRuntimeConfig } from "@uwe/connector";

import type { ClaimedJob, HostClient } from "./host-client";
import type { DetectedCapabilities } from "./local-capabilities";
import { ConnectorRunner } from "./runner";

const baseConfig: ConnectorRuntimeConfig = {
  hostUrl: "https://host.test",
  token: "uwec_test",
  name: "Test Connector",
  queueEnabled: true,
  pollIntervalMs: 1000,
  heartbeatIntervalMs: 15000,
  forcedCapabilities: ["audio_local", "llm_local"],
};

const snapshot: DetectedCapabilities = {
  capabilities: ["audio_local", "llm_local"],
  models: [{ provider: "ollama", name: "llama3.2" }],
  printers: [],
};

class FakeClient {
  heartbeats = 0;
  completed: Array<{ id: string; result: Record<string, unknown> }> = [];
  failed: Array<{ id: string; reason: string }> = [];
  claimLanes: string[][] = [];
  queue: (ClaimedJob | null)[] = [];

  async heartbeat() {
    this.heartbeats += 1;
    return {
      connector: { id: "c1", name: "Test", status: "online", queueEnabled: true },
      config: {
        pollIntervalMs: 1000,
        heartbeatIntervalMs: 15000,
        queueEnabled: true,
        cloudFallbackAllowed: false,
        capabilities: [],
        jobTypes: [],
      },
      activeJobIds: [],
    };
  }

  async claimJob(lanes: string[]) {
    this.claimLanes.push([...lanes]);
    return this.queue.shift() ?? null;
  }

  async completeJob(id: string, result: Record<string, unknown>) {
    this.completed.push({ id, result });
  }

  async failJob(id: string, reason: string) {
    this.failed.push({ id, reason });
  }
}

function job(id: string, type: string, lane: ClaimedJob["lane"]): ClaimedJob {
  return { id, type, lane, priority: 50, payload: {}, worldId: null, expiresAt: null };
}

function makeRunner(client: FakeClient, execute?: (j: ClaimedJob) => Promise<Record<string, unknown>>) {
  return new ConnectorRunner({
    client: client as unknown as HostClient,
    config: baseConfig,
    version: "test",
    discover: async () => snapshot,
    executorBase: { requestTimeoutMs: 1000 },
    execute: execute ? (j) => execute(j) : async () => ({ ok: true }),
  });
}

test("claims a job, runs it and reports completion", async () => {
  const client = new FakeClient();
  client.queue.push(job("j1", "sound_play", "audio"));
  const runner = makeRunner(client);
  await runner.refresh();

  const claimed = await runner.pollOnce();
  assert.equal(claimed?.id, "j1");
  // wait for the async dispatch to finish
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(client.completed.length, 1);
  assert.equal(client.completed[0].id, "j1");
});

test("audio lane stays available while a GPU job runs (overtaking)", async () => {
  const client = new FakeClient();
  let releaseGpu: () => void = () => {};
  const gpuDone = new Promise<void>((resolve) => {
    releaseGpu = resolve;
  });

  const runner = makeRunner(client, async (j) => {
    if (j.lane === "gpu") {
      await gpuDone; // hold the gpu lane busy
    }
    return { ok: true };
  });
  await runner.refresh();

  // First poll claims a GPU job which blocks.
  client.queue.push(job("gpu1", "llm_generate", "gpu"));
  await runner.pollOnce();

  // Second poll while GPU is busy: lanes must exclude gpu but include audio.
  client.queue.push(job("aud1", "sound_play", "audio"));
  await runner.pollOnce();

  const lastLanes = client.claimLanes[client.claimLanes.length - 1];
  assert.ok(!lastLanes.includes("gpu"), "gpu lane is busy and not offered");
  assert.ok(lastLanes.includes("audio"), "audio lane remains available");

  releaseGpu();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(client.completed.length, 2);
});

test("reports failure when the executor throws", async () => {
  const client = new FakeClient();
  client.queue.push(job("bad", "image_generate", "gpu"));
  const runner = makeRunner(client, async () => {
    throw new Error("no image backend");
  });
  await runner.refresh();

  await runner.pollOnce();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(client.failed.length, 1);
  assert.equal(client.failed[0].reason, "no image backend");
});

test("does not claim when queue is disabled locally", async () => {
  const client = new FakeClient();
  const runner = new ConnectorRunner({
    client: client as unknown as HostClient,
    config: { ...baseConfig, queueEnabled: false },
    version: "test",
    discover: async () => snapshot,
    executorBase: { requestTimeoutMs: 1000 },
  });
  await runner.refresh();
  const claimed = await runner.pollOnce();
  assert.equal(claimed, null);
  assert.equal(client.claimLanes.length, 0);
});

test("graceful stop drains active jobs and sends a final heartbeat", async () => {
  const client = new FakeClient();
  client.queue.push(job("j1", "sound_play", "audio"));
  const runner = makeRunner(client);
  await runner.refresh();
  await runner.pollOnce();
  await runner.stop(1000);
  assert.equal(client.completed.length, 1);
  assert.ok(client.heartbeats >= 1, "final heartbeat sent on shutdown");
});
