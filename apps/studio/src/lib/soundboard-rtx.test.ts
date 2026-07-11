import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DirectConnectorDispatchError } from "@uwe/connector/direct";
import type {
  ConnectorJob,
  ConnectorSummary,
  EnqueueConnectorJobInput,
} from "@uwe/database/server";

import { dispatchSoundboardRtx, type SoundboardRtxDeps } from "./soundboard-rtx";

function makeDeps(options: {
  direct?: boolean;
  queueEnabled?: boolean;
  dispatch?: SoundboardRtxDeps["registry"]["dispatch"];
} = {}): { deps: SoundboardRtxDeps; enqueued: EnqueueConnectorJobInput[] } {
  const enqueued: EnqueueConnectorJobInput[] = [];
  const summary: ConnectorSummary = {
    anyOnline: true,
    onlineCount: 1,
    totalCount: 1,
    availableCapabilities: ["audio_local"],
    connectors: [{
      id: "connector-1",
      status: "online",
      disabled: false,
      queueEnabled: options.queueEnabled ?? true,
      capabilities: ["audio_local"],
    } as ConnectorSummary["connectors"][number]],
  };

  return {
    enqueued,
    deps: {
      registry: {
        hasCapability: () => options.direct ?? true,
        dispatch: options.dispatch ?? (async () => ({
          requestId: "request-1",
          result: { ok: true },
          connectorId: "connector-1",
        })),
      },
      service: {
        summarize: async () => summary,
        enqueueJob: async (input) => {
          enqueued.push(input);
          return { id: "job-1", type: input.type } as ConnectorJob;
        },
      },
      resolveWorld: async () => ({ id: "world-1" }),
    },
  };
}

describe("dispatchSoundboardRtx", () => {
  it("delivers directly without enqueueing", async () => {
    const { deps, enqueued } = makeDeps();
    const response = await dispatchSoundboardRtx(
      "terra",
      { action: "play", sourceUrl: "/audio/theme.mp3" },
      deps,
    );
    assert.deepEqual(await response.json(), {
      queued: false,
      delivery: "direct",
      requestId: "request-1",
    });
    assert.equal(enqueued.length, 0);
  });

  it("falls back to the queue before Direct acceptance", async () => {
    const { deps, enqueued } = makeDeps({
      dispatch: async () => {
        throw new DirectConnectorDispatchError("stream closed", false, "request-1");
      },
    });
    const response = await dispatchSoundboardRtx("terra", { action: "stop_all" }, deps);
    const body = (await response.json()) as { delivery: string; jobId: string };
    assert.equal(body.delivery, "queue");
    assert.equal(body.jobId, "job-1");
    assert.equal(enqueued.length, 1);
  });

  it("never enqueues after Direct acceptance", async () => {
    const { deps, enqueued } = makeDeps({
      dispatch: async () => {
        throw new DirectConnectorDispatchError("result lost", true, "request-1");
      },
    });
    const response = await dispatchSoundboardRtx("terra", { action: "volume", volume: 40 }, deps);
    const body = (await response.json()) as {
      delivery: string;
      uncertain: boolean;
      degraded: boolean;
    };
    assert.equal(body.delivery, "direct");
    assert.equal(body.uncertain, true);
    assert.equal(body.degraded, true);
    assert.equal(enqueued.length, 0);
  });

  it("does not queue through a Direct-only connector", async () => {
    const { deps, enqueued } = makeDeps({ direct: false, queueEnabled: false });
    const response = await dispatchSoundboardRtx("terra", { action: "stop" }, deps);
    const body = (await response.json()) as { delivery: string; degraded: boolean };
    assert.equal(body.delivery, "unavailable");
    assert.equal(body.degraded, true);
    assert.equal(enqueued.length, 0);
  });
});
