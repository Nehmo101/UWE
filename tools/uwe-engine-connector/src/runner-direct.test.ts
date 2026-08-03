import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DIRECT_PROTOCOL_VERSION,
  type ConnectorRuntimeConfig,
  type DirectConnectorEvent,
  type DirectRequestFrame,
} from "@uwe/connector";

import type { DirectStreamClient, DirectRequestHandler } from "./direct-stream-client";
import type { HostClient } from "./host-client";
import type { DetectedCapabilities } from "./local-capabilities";
import { ConnectorRunner } from "./runner";

async function waitUntil(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("condition not met");
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

const snapshot: DetectedCapabilities = {
  capabilities: ["audio_local", "image_local"],
  models: [],
  printers: [],
};

const config: ConnectorRuntimeConfig = {
  hostUrl: "https://host.test",
  token: "uwec_test",
  name: "Direct Test",
  transportMode: "direct",
  queueEnabled: false,
  pollIntervalMs: 5,
  heartbeatIntervalMs: 60_000,
  forcedCapabilities: [],
};

class FakeHost {
  claims = 0;

  async heartbeat() {
    return {
      connector: { id: "c1", name: "Direct", status: "online", queueEnabled: false },
      config: {
        pollIntervalMs: 5,
        heartbeatIntervalMs: 60_000,
        queueEnabled: false,
        cloudFallbackAllowed: false,
        capabilities: [],
        jobTypes: [],
      },
      activeJobIds: [],
    };
  }

  async claimJob() {
    this.claims += 1;
    return null;
  }
}

class FakeDirect {
  events: DirectConnectorEvent[] = [];
  starts = 0;
  stops = 0;
  handler: DirectRequestHandler | undefined;

  start(handler: DirectRequestHandler) {
    this.starts += 1;
    this.handler = handler;
  }

  async stop() {
    this.stops += 1;
  }

  async sendEvent(event: DirectConnectorEvent) {
    this.events.push(event);
  }
}

function request(overrides: Partial<DirectRequestFrame> = {}): DirectRequestFrame {
  return {
    version: DIRECT_PROTOCOL_VERSION,
    kind: "request",
    requestId: "req-1",
    type: "sound_play",
    lane: "audio",
    priority: 50,
    payload: { sourceUrl: "local.wav" },
    ...overrides,
  };
}

function makeRunner(
  direct: FakeDirect,
  execute: () => Promise<Record<string, unknown>> = async () => ({ ok: true }),
): ConnectorRunner {
  return new ConnectorRunner({
    client: new FakeHost() as unknown as HostClient,
    directClient: direct as unknown as DirectStreamClient,
    config,
    version: "test",
    discover: async () => snapshot,
    executorBase: { requestTimeoutMs: 100 },
    execute,
  });
}

test("direct dispatch reserves a lane before accepted and reports result", async () => {
  const direct = new FakeDirect();
  const runner = makeRunner(direct);

  assert.equal(await runner.dispatchDirect(request()), true);
  assert.equal(direct.events[0]?.kind, "accepted");
  await waitUntil(() => direct.events.some((event) => event.kind === "result"));
  assert.deepEqual(direct.events.map((event) => event.kind), ["accepted", "result"]);
});

test("direct dispatch reports executor errors after accepted", async () => {
  const direct = new FakeDirect();
  const runner = makeRunner(direct, async () => {
    throw new Error("backend unavailable");
  });

  assert.equal(await runner.dispatchDirect(request()), true);
  await waitUntil(() => direct.events.some((event) => event.kind === "error"));
  assert.deepEqual(direct.events.map((event) => event.kind), ["accepted", "error"]);
  const error = direct.events[1];
  assert.equal(error?.kind === "error" ? error.message : undefined, "backend unavailable");
});

test("direct dispatch rejects mismatched lanes and expired requests before accepted", async () => {
  const direct = new FakeDirect();
  const runner = makeRunner(direct);

  assert.equal(await runner.dispatchDirect(request({ lane: "gpu" })), false);
  assert.equal(
    await runner.dispatchDirect(
      request({ requestId: "expired", expiresAt: new Date(Date.now() - 1_000).toISOString() }),
    ),
    false,
  );

  assert.deepEqual(direct.events.map((event) => event.kind), ["error", "error"]);
  assert.deepEqual(
    direct.events.map((event) => (event.kind === "error" ? event.code : undefined)),
    ["invalid_lane", "request_expired"],
  );
});

test("graceful stop keeps the Direct channel open until accepted work drains", async () => {
  const direct = new FakeDirect();
  let finishExecution: ((value: Record<string, unknown>) => void) | undefined;
  const runner = makeRunner(
    direct,
    () => new Promise((resolve) => {
      finishExecution = resolve;
    }),
  );

  assert.equal(await runner.dispatchDirect(request()), true);
  const stopping = runner.stop(1_000);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(direct.stops, 0);

  finishExecution?.({ ok: true });
  await stopping;
  assert.equal(direct.stops, 1);
  assert.deepEqual(direct.events.map((event) => event.kind), ["accepted", "result"]);
});
test("direct mode starts the stream and never polls the queue", async () => {
  const direct = new FakeDirect();
  const host = new FakeHost();
  const runner = new ConnectorRunner({
    client: host as unknown as HostClient,
    directClient: direct as unknown as DirectStreamClient,
    config,
    version: "test",
    discover: async () => snapshot,
    executorBase: { requestTimeoutMs: 100 },
  });

  await runner.start();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await runner.stop(100);

  assert.equal(direct.starts, 1);
  assert.equal(direct.stops, 1);
  assert.equal(host.claims, 0);
});
