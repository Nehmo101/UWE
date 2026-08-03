import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COOKBOOK_MODEL_REGISTRY, estimateModelVramGb, getCookbookModel } from "./model-registry";
import { computeModelFit, rankModelsForHardware } from "./model-fit";
import type { CookbookHardwareProfile } from "./types";

const GPU_8GB_PROFILE: CookbookHardwareProfile = {
  platform: "linux",
  arch: "x64",
  cpuCores: 8,
  ramGb: 32,
  backend: "cuda",
  gpuName: "Test-GPU 8 GB",
  gpuVramGb: 8,
  gpuCount: 1,
  gpus: [{ index: 0, name: "Test-GPU 8 GB", vramGb: 8 }],
  gpuGroups: [
    {
      name: "Test-GPU 8 GB",
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

    const smallFit = computeModelFit(GPU_8GB_PROFILE, small, { useCase: "editor_rewrite" });
    const largeFit = computeModelFit(GPU_8GB_PROFILE, large, { useCase: "deep_research" });

    assert.ok(smallFit.score > largeFit.score);
    assert.equal(smallFit.fitsGpu, true);
    assert.equal(largeFit.fitsGpu, false);
  });

  it("ranks models for dnd_generator use case", () => {
    const ranked = rankModelsForHardware(GPU_8GB_PROFILE, {
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

  it("prefers larger models when they fit on a high-VRAM rig", () => {
    // 32GB rig: an added strong GPU means the bigger model that still fits
    // should out-score a tiny one for the same use case (capability bonus).
    const bigRig: CookbookHardwareProfile = {
      ...GPU_8GB_PROFILE,
      gpuName: "NVIDIA GeForce Maschinenraum 3090",
      gpuVramGb: 32,
      gpuCount: 2,
      gpus: [
        { index: 0, name: "Test-GPU 8 GB", vramGb: 8 },
        { index: 1, name: "NVIDIA GeForce Maschinenraum 3090", vramGb: 24 },
      ],
      homogeneousGpus: false,
    };

    const small = getCookbookModel("llama3.2"); // 3B
    const large = getCookbookModel("qwen2.5:14b"); // 14B
    assert.ok(small && large);

    const smallFit = computeModelFit(bigRig, small, { useCase: "canon_check" });
    const largeFit = computeModelFit(bigRig, large, { useCase: "canon_check" });

    assert.equal(smallFit.fitsGpu, true);
    assert.equal(largeFit.fitsGpu, true);
    assert.ok(
      largeFit.score > smallFit.score,
      `expected 14B (${largeFit.score}) to out-score 3B (${smallFit.score}) on a 32GB rig`,
    );

    // The 14B must not fit on the 8GB laptop, so small still wins there.
    const smallOn8 = computeModelFit(GPU_8GB_PROFILE, small, { useCase: "canon_check" });
    const largeOn8 = computeModelFit(GPU_8GB_PROFILE, large, { useCase: "canon_check" });
    assert.equal(largeOn8.fitsGpu, false);
    assert.ok(smallOn8.score > largeOn8.score);
  });
});
