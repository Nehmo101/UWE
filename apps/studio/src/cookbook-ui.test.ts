import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCookbookRecommendations } from "@uwe/cookbook";

const EXPECTED_USE_CASES = [
  "dnd_generator",
  "deep_research",
  "editor_rewrite",
  "image_prompting",
  "session_prep",
  "canon_check",
  "player_safe_rewrite",
  "document_ocr",
] as const;
import type { CookbookHardwareProfile } from "@uwe/cookbook";

const HARDWARE: CookbookHardwareProfile = {
  platform: "linux",
  arch: "x64",
  cpuCores: 8,
  ramGb: 32,
  backend: "cuda",
  gpuName: "Test-GPU 8 GB",
  gpuVramGb: 8,
  gpuCount: 1,
  gpus: [{ index: 0, name: "Test-GPU 8 GB", vramGb: 8 }],
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
    // Explizit statt nur gezählt: so sagt ein Fehlschlag, welcher
    // Anwendungsfall fehlt oder zu viel ist. `theme_design` steht bewusst
    // nicht drin — dafür gibt es keine Hardware-Empfehlung.
    assert.deepEqual(new Set(useCases), new Set(EXPECTED_USE_CASES));
    assert.equal(recs.length, EXPECTED_USE_CASES.length);
  });

  it("marks private use cases with privacy notes", () => {
    const recs = buildCookbookRecommendations(HARDWARE);
    const canon = recs.find((r) => r.useCase === "canon_check");
    assert.ok(canon?.privacyNote.includes("lokal"));
  });
});
