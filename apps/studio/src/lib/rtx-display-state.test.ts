import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RtxReadinessStatus } from "@uwe/ai-brain/router";
import {
  mapRtxReadinessToConnectorState,
  resolveRtxReadinessSourceLabel,
  rtxReadinessSourceLabelDe,
} from "./rtx-display-state";

function status(partial: Partial<RtxReadinessStatus>): RtxReadinessStatus {
  return {
    online: false,
    ready: false,
    message: "offline",
    providerId: "local_rtx",
    endpoint: "192.168.1.10:11434",
    defaultModel: "llama3.2",
    urlAllowed: true,
    urlKind: "private",
    modelCount: 0,
    agentStatus: "unreachable",
    source: "inference",
    ...partial,
  };
}

describe("rtx display state", () => {
  it("maps connector readiness to online", () => {
    assert.equal(
      mapRtxReadinessToConnectorState(
        status({ ready: true, online: true, source: "connector", connectorReady: true }),
      ),
      "online",
    );
  });

  it("maps degraded connector readiness to starting", () => {
    assert.equal(
      mapRtxReadinessToConnectorState(
        status({
          ready: true,
          online: true,
          source: "connector",
          connectorDegraded: true,
        }),
      ),
      "starting",
    );
  });

  it("labels connector and inference sources", () => {
    assert.equal(resolveRtxReadinessSourceLabel(status({ source: "connector" })), "connector");
    assert.equal(resolveRtxReadinessSourceLabel(status({ source: "inference" })), "inference");
    assert.equal(rtxReadinessSourceLabelDe(status({ source: "connector" })), "Maschinenraum");
  });
});
