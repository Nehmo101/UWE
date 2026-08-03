import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EngineReadinessStatus } from "@uwe/ai-brain/router";
import {
  mapEngineReadinessToConnectorState,
  resolveEngineReadinessSourceLabel,
  engineReadinessSourceLabelDe,
} from "./engine-display-state";

function status(partial: Partial<EngineReadinessStatus>): EngineReadinessStatus {
  return {
    online: false,
    ready: false,
    message: "offline",
    providerId: "local_engine",
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

describe("engine display state", () => {
  it("maps connector readiness to online", () => {
    assert.equal(
      mapEngineReadinessToConnectorState(
        status({ ready: true, online: true, source: "connector", connectorReady: true }),
      ),
      "online",
    );
  });

  it("maps degraded connector readiness to starting", () => {
    assert.equal(
      mapEngineReadinessToConnectorState(
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
    assert.equal(resolveEngineReadinessSourceLabel(status({ source: "connector" })), "connector");
    assert.equal(resolveEngineReadinessSourceLabel(status({ source: "inference" })), "inference");
    assert.equal(engineReadinessSourceLabelDe(status({ source: "connector" })), "Maschinenraum");
  });
});
