import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCookbookRecommendations } from "@uwe/cookbook";
import type { CookbookHardwareProfile } from "@uwe/cookbook";

const HARDWARE: CookbookHardwareProfile = {
  platform: "linux",
  arch: "x64",
  cpuCores: 8,
  ramGb: 32,
  backend: "cuda",
  gpuName: "RTX 4060",
  gpuVramGb: 8,
  gpuCount: 1,
  gpus: [{ index: 0, name: "RTX 4060", vramGb: 8 }],
  gpuGroups: [],
  unifiedMemory: false,
  homogeneousGpus: true,
  probeSource: "env",
  probeMessage: "test",
  probedAt: new Date().toISOString(),
};

describe("cookbook recommendations", () => {
  it("returns all UWE use cases", () => {
    const recs = buildCookbookRecommendations(HARDWARE, ["llama3.1:8b"]);
    const useCases = recs.map((r) => r.useCase);
    assert.ok(useCases.includes("dnd_generator"));
    assert.ok(useCases.includes("canon_check"));
    assert.ok(useCases.includes("player_safe_rewrite"));
    assert.equal(recs.length, 7);
  });

  it("marks private use cases with privacy notes", () => {
    const recs = buildCookbookRecommendations(HARDWARE);
    const canon = recs.find((r) => r.useCase === "canon_check");
    assert.ok(canon?.privacyNote.includes("lokal"));
  });
});
