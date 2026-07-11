import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DirectConnectorDispatchError } from "@uwe/connector/direct";
import type {
  ConnectorJob,
  ConnectorSummary,
  EnqueueConnectorJobInput,
} from "@uwe/database/server";

import {
  isSpotifyConnectAvailable,
  tryDispatchSpotifyConnector,
  type SpotifyConnectorDeps,
} from "./spotify-connector";

function summaryWith(capabilities: string[], queueEnabled = true): ConnectorSummary {
  return {
    anyOnline: capabilities.length > 0,
    onlineCount: capabilities.length > 0 ? 1 : 0,
    totalCount: 1,
    availableCapabilities: capabilities as ConnectorSummary["availableCapabilities"],
    connectors: [{
      id: "connector-1",
      status: capabilities.length > 0 ? "online" : "offline",
      disabled: false,
      queueEnabled,
      capabilities,
    } as ConnectorSummary["connectors"][number]],
  };
}

interface StubOptions {
  capabilities?: string[];
  world?: { id: string } | null;
  direct?: boolean;
  queueEnabled?: boolean;
  dispatch?: SpotifyConnectorDeps["registry"]["dispatch"];
}

function makeDeps(options: StubOptions = {}): {
  deps: SpotifyConnectorDeps;
  enqueued: EnqueueConnectorJobInput[];
} {
  const capabilities = options.capabilities ?? ["spotify_connect"];
  const world = options.world === undefined ? { id: "world-1" } : options.world;
  const enqueued: EnqueueConnectorJobInput[] = [];

  const deps: SpotifyConnectorDeps = {
    service: {
      summarize: async () => summaryWith(capabilities, options.queueEnabled ?? true),
      enqueueJob: async (input) => {
        enqueued.push(input);
        return { id: "job-1", type: input.type } as ConnectorJob;
      },
    },
    registry: {
      hasCapability: () => options.direct ?? false,
      dispatch: options.dispatch ?? (async () => ({
        requestId: "request-1",
        result: { ok: true },
        connectorId: "connector-1",
      })),
    },
    resolveWorld: async () => world,
  };

  return { deps, enqueued };
}

describe("isSpotifyConnectAvailable", () => {
  it("is true when the queue advertises spotify_connect", async () => {
    const { deps } = makeDeps({ capabilities: ["spotify_connect"] });
    assert.equal(await isSpotifyConnectAvailable(deps), true);
  });

  it("is true when a Direct session advertises spotify_connect", async () => {
    const { deps } = makeDeps({ capabilities: [], queueEnabled: false, direct: true });
    assert.equal(await isSpotifyConnectAvailable(deps), true);
  });

  it("is false when neither delivery path advertises spotify_connect", async () => {
    const { deps } = makeDeps({ capabilities: ["audio_local"] });
    assert.equal(await isSpotifyConnectAvailable(deps), false);
  });
});

describe("tryDispatchSpotifyConnector", () => {
  it("returns null when spotify_connect is unavailable", async () => {
    const { deps, enqueued } = makeDeps({ capabilities: [] });
    const result = await tryDispatchSpotifyConnector(
      "terra",
      { action: "play", uri: "spotify:track:abc" },
      deps,
    );
    assert.equal(result, null);
    assert.equal(enqueued.length, 0);
  });

  it("dispatches directly without enqueueing", async () => {
    const { deps, enqueued } = makeDeps({ direct: true });
    const result = await tryDispatchSpotifyConnector(
      "terra",
      { action: "play", uri: " spotify:track:abc ", volume: 50 },
      deps,
    );
    assert.ok(result);
    const body = (await result.json()) as { delivery: string; requestId: string };
    assert.equal(body.delivery, "direct");
    assert.equal(body.requestId, "request-1");
    assert.equal(enqueued.length, 0);
  });

  it("falls back to the queue before Direct acceptance", async () => {
    const { deps, enqueued } = makeDeps({
      direct: true,
      dispatch: async () => {
        throw new DirectConnectorDispatchError("stream closed", false, "request-1");
      },
    });
    const result = await tryDispatchSpotifyConnector("terra", { action: "pause" }, deps);
    assert.ok(result);
    const body = (await result.json()) as { delivery: string; jobId: string };
    assert.equal(body.delivery, "queue");
    assert.equal(body.jobId, "job-1");
    assert.equal(enqueued.length, 1);
  });

  it("never enqueues after Direct acceptance", async () => {
    const { deps, enqueued } = makeDeps({
      direct: true,
      dispatch: async () => {
        throw new DirectConnectorDispatchError("result lost", true, "request-1");
      },
    });
    const result = await tryDispatchSpotifyConnector("terra", { action: "pause" }, deps);
    assert.ok(result);
    const body = (await result.json()) as {
      delivery: string;
      uncertain: boolean;
      degraded: boolean;
    };
    assert.equal(body.delivery, "direct");
    assert.equal(body.uncertain, true);
    assert.equal(body.degraded, true);
    assert.equal(enqueued.length, 0);
  });

  it("enqueues a spotify_play job with the uri payload", async () => {
    const { deps, enqueued } = makeDeps();
    const result = await tryDispatchSpotifyConnector(
      "terra",
      { action: "play", uri: " spotify:track:abc ", volume: 50 },
      deps,
    );
    assert.ok(result);
    const body = (await result.json()) as { queued: boolean; delivery: string; jobId: string };
    assert.equal(body.queued, true);
    assert.equal(body.delivery, "queue");
    assert.equal(body.jobId, "job-1");
    assert.equal(enqueued[0].type, "spotify_play");
    assert.equal(enqueued[0].worldId, "world-1");
    assert.deepEqual(enqueued[0].payload, { uri: "spotify:track:abc", volume: 50 });
  });

  it("maps stop, resume, and volume to queue job types", async () => {
    const stop = makeDeps();
    await tryDispatchSpotifyConnector("terra", { action: "stop" }, stop.deps);
    assert.equal(stop.enqueued[0].type, "spotify_pause");

    const resume = makeDeps();
    await tryDispatchSpotifyConnector("terra", { action: "resume" }, resume.deps);
    assert.equal(resume.enqueued[0].type, "spotify_play");

    const volume = makeDeps();
    await tryDispatchSpotifyConnector("terra", { action: "volume", volume: 30 }, volume.deps);
    assert.equal(volume.enqueued[0].type, "spotify_volume");
    assert.deepEqual(volume.enqueued[0].payload, { volume: 30 });
  });

  it("returns 404 when the world is missing but a connector path is available", async () => {
    const { deps, enqueued } = makeDeps({ world: null });
    const result = await tryDispatchSpotifyConnector("ghost", { action: "pause" }, deps);
    assert.ok(result);
    assert.equal(result.status, 404);
    assert.equal(enqueued.length, 0);
  });
});
