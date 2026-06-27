import assert from "node:assert/strict";
import { describe, it } from "node:test";

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

function summaryWith(capabilities: string[]): ConnectorSummary {
  return {
    anyOnline: capabilities.length > 0,
    onlineCount: capabilities.length > 0 ? 1 : 0,
    totalCount: 1,
    availableCapabilities: capabilities as ConnectorSummary["availableCapabilities"],
    connectors: [],
  };
}

interface StubOptions {
  capabilities?: string[];
  world?: { id: string } | null;
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
      summarize: async () => summaryWith(capabilities),
      capabilityAvailable: (summary, capability) =>
        summary.availableCapabilities.includes(capability),
      enqueueJob: async (input) => {
        enqueued.push(input);
        return { id: "job-1", type: input.type } as ConnectorJob;
      },
    },
    resolveWorld: async () => world,
  };

  return { deps, enqueued };
}

describe("isSpotifyConnectAvailable", () => {
  it("is true when a connector advertises spotify_connect", async () => {
    const { deps } = makeDeps({ capabilities: ["spotify_connect"] });
    assert.equal(await isSpotifyConnectAvailable(deps), true);
  });

  it("is false when no connector advertises spotify_connect", async () => {
    const { deps } = makeDeps({ capabilities: ["audio_local"] });
    assert.equal(await isSpotifyConnectAvailable(deps), false);
  });
});

describe("tryDispatchSpotifyConnector", () => {
  it("returns null (caller falls back) when spotify_connect is offline", async () => {
    const { deps, enqueued } = makeDeps({ capabilities: [] });
    const result = await tryDispatchSpotifyConnector(
      "terra",
      { action: "play", uri: "spotify:track:abc" },
      deps,
    );
    assert.equal(result, null);
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
    assert.equal(result.status, 200);
    const body = (await result.json()) as { queued: boolean; jobId: string; via: string };
    assert.equal(body.queued, true);
    assert.equal(body.jobId, "job-1");
    assert.equal(body.via, "rtx-connector");

    assert.equal(enqueued.length, 1);
    assert.equal(enqueued[0].type, "spotify_play");
    assert.equal(enqueued[0].worldId, "world-1");
    assert.deepEqual(enqueued[0].payload, { uri: "spotify:track:abc", volume: 50 });
  });

  it("maps stop and resume to pause/play job types", async () => {
    const stop = makeDeps();
    await tryDispatchSpotifyConnector("terra", { action: "stop" }, stop.deps);
    assert.equal(stop.enqueued[0].type, "spotify_pause");

    const resume = makeDeps();
    await tryDispatchSpotifyConnector("terra", { action: "resume" }, resume.deps);
    assert.equal(resume.enqueued[0].type, "spotify_play");
    assert.deepEqual(resume.enqueued[0].payload, {});
  });

  it("maps volume to a spotify_volume job", async () => {
    const { deps, enqueued } = makeDeps();
    await tryDispatchSpotifyConnector("terra", { action: "volume", volume: 30 }, deps);
    assert.equal(enqueued[0].type, "spotify_volume");
    assert.deepEqual(enqueued[0].payload, { volume: 30 });
  });

  it("returns 404 when the world is missing but the capability is online", async () => {
    const { deps, enqueued } = makeDeps({ world: null });
    const result = await tryDispatchSpotifyConnector("ghost", { action: "pause" }, deps);
    assert.ok(result);
    assert.equal(result.status, 404);
    assert.equal(enqueued.length, 0);
  });
});
