import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COOKBOOK_MODEL_REGISTRY, estimateModelVramGb, getCookbookModel } from "./model-registry";
import { computeModelFit, rankModelsForHardware } from "./model-fit";
import type { CookbookHardwareProfile } from "./types";

const RTX_4060_PROFILE: CookbookHardwareProfile = {
  platform: "linux",
  arch: "x64",
  cpuCores: 8,
  ramGb: 32,
  backend: "cuda",
  gpuName: "NVIDIA GeForce RTX 4060",
  gpuVramGb: 8,
  gpuCount: 1,
  gpus: [{ index: 0, name: "NVIDIA GeForce RTX 4060", vramGb: 8 }],
  gpuGroups: [
    {
      name: "NVIDIA GeForce RTX 4060",
      vramEachGb: 8,
      count: 1,
      indices: [0],
      vramTotalGb: 8,
    },
  ],
  unifiedMemory: false,
  homogeneousGpus: true,
  probeSource: "nvidia-smi",
  probeMessage: "test",
  probedAt: new Date().toISOString(),
};

describe("model-fit", () => {
  it("scores small models higher on 8GB VRAM", () => {
    const small = getCookbookModel("llama3.2");
    const large = getCookbookModel("llama3.1:70b");
    assert.ok(small && large);

    const smallFit = computeModelFit(RTX_4060_PROFILE, small, { useCase: "editor_rewrite" });
    const largeFit = computeModelFit(RTX_4060_PROFILE, large, { useCase: "deep_research" });

    assert.ok(smallFit.score > largeFit.score);
    assert.equal(smallFit.fitsGpu, true);
    assert.equal(largeFit.fitsGpu, false);
  });

  it("ranks models for dnd_generator use case", () => {
    const ranked = rankModelsForHardware(RTX_4060_PROFILE, {
      useCase: "dnd_generator",
      models: COOKBOOK_MODEL_REGISTRY.filter((m) => m.useCases.includes("dnd_generator")),
      limit: 3,
    });

    assert.ok(ranked.length > 0);
    assert.ok(ranked[0]!.score >= ranked[ranked.length - 1]!.score);
  });

  it("estimates VRAM grows with model size", () => {
    const small = getCookbookModel("llama3.2");
    const medium = getCookbookModel("llama3.1:8b");
    assert.ok(small && medium);
    assert.ok(estimateModelVramGb(medium) > estimateModelVramGb(small));
  });
});
