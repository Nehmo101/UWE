import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCookbookRuntimeHealth } from "./runtime-health";
import { diagnoseServeOutput } from "./diagnostics";
import type { CookbookRuntimeProbeInput } from "./ai-types";

const ONLINE_PROBE: CookbookRuntimeProbeInput = {
  inference: {
    enabled: true,
    providerId: "ollama",
    endpoint: "http://localhost:11434",
    defaultModel: "llama3.2",
    online: true,
    message: "Inference online",
    urlAllowed: true,
    modelCount: 2,
  },
  rtx: {
    ready: true,
    online: true,
    endpoint: "http://192.168.1.50:8787",
    defaultModel: "llama3.2",
    message: "RTX agent ready",
    urlAllowed: true,
    modelCount: 2,
    agentConfigured: true,
  },
  skipDocker: true,
};

describe("runtime-health", () => {
  it("reports healthy when inference and rtx are ready", async () => {
    const health = await buildCookbookRuntimeHealth(ONLINE_PROBE, { localOnlyMode: false });
    assert.equal(health.ok, true);
    assert.equal(health.engines.length > 0, true);
  });

  it("warns when local-only but offline", async () => {
    const health = await buildCookbookRuntimeHealth(
      {
        ...ONLINE_PROBE,
        inference: { ...ONLINE_PROBE.inference, online: false, message: "offline" },
        rtx: { ...ONLINE_PROBE.rtx, ready: false, online: false, message: "offline" },
      },
      { localOnlyMode: true },
    );

    assert.equal(health.ok, false);
    assert.ok(health.warnings.some((w) => w.includes("Local-only")));
  });
});

describe("diagnostics", () => {
  it("detects CUDA OOM patterns", () => {
    const diagnoses = diagnoseServeOutput("torch.cuda.OutOfMemoryError: CUDA out of memory");
    assert.ok(diagnoses.length > 0);
    assert.match(diagnoses[0]!.summary, /GPU/i);
  });

  it("detects connection refused", () => {
    const diagnoses = diagnoseServeOutput("fetch failed ECONNREFUSED localhost:11434");
    assert.ok(diagnoses.some((d) => d.summary.includes("nicht erreichbar")));
  });
});
