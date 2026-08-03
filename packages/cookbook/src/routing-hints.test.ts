import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCookbookRoutingHints,
  isPrivateContextMode,
  resolveCookbookModelForRequest,
} from "./routing-hints";
import type { CookbookHardwareProfile } from "./types";

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

describe("routing-hints", () => {
  it("blocks cloud for personal_brain context (hard rule)", () => {
    assert.equal(isPrivateContextMode("personal_brain"), true);
    assert.equal(isPrivateContextMode("general_chat"), false);
    // W0 policy: DnD modes are no longer private (allowed to cloud when policy permits)
    assert.equal(isPrivateContextMode("brain"), false);
    assert.equal(isPrivateContextMode("current_object"), false);
    assert.equal(isPrivateContextMode("current_object_plus_brain"), false);

    const hints = buildCookbookRoutingHints({
      providerMode: "cloud",
      contextMode: "personal_brain",
      taskType: "improve_lore_text",
      localOnlyMode: false,
      engineReady: false,
      hardware: HARDWARE,
    });

    assert.equal(hints.cloudBlocked, true);
    assert.ok(hints.cloudBlockReason?.includes("Cloud"));
    assert.equal(hints.preferLocal, true);
  });

  it("does not block cloud for DnD brain context when policy allows (W0 policy)", () => {
    const hints = buildCookbookRoutingHints({
      providerMode: "cloud",
      contextMode: "brain",
      taskType: "summarize_page",
      localOnlyMode: false,
      engineReady: false,
      hardware: HARDWARE,
    });

    assert.equal(hints.cloudBlocked, false);
    assert.equal(hints.cloudBlockReason, null);
  });

  it("blocks cloud when local-only mode is active", () => {
    const hints = buildCookbookRoutingHints({
      providerMode: "auto",
      contextMode: "general_chat",
      taskType: "summarize_page",
      localOnlyMode: true,
      engineReady: true,
      hardware: HARDWARE,
    });

    assert.equal(hints.cloudBlocked, true);
    assert.equal(hints.preferLocal, true);
  });

  it("recommends cookbook model for task when installed", () => {
    const model = resolveCookbookModelForRequest({
      taskType: "create_npc",
      engineDefaultModel: "llama3.2",
      hardware: HARDWARE,
      installedModels: ["qwen2.5:7b"],
    });

    assert.equal(model, "qwen2.5:7b");
  });

  it("keeps explicit model override", () => {
    const model = resolveCookbookModelForRequest({
      explicitModel: "custom-model",
      taskType: "create_npc",
      engineDefaultModel: "llama3.2",
      hardware: HARDWARE,
    });

    assert.equal(model, "custom-model");
  });
});
