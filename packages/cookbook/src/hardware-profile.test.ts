import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectHardwareProfile } from "./hardware-profile";

describe("hardware-profile", () => {
  it("uses COOKBOOK_GPU_* env override", async () => {
    const profile = await detectHardwareProfile({
      env: {
        COOKBOOK_GPU_VRAM_GB: "12",
        COOKBOOK_GPU_NAME: "Test GPU",
      },
    });

    assert.equal(profile.gpuVramGb, 12);
    assert.equal(profile.gpuName, "Test GPU");
    assert.equal(profile.probeSource, "env");
  });

  it("always reports RAM and CPU cores", async () => {
    const profile = await detectHardwareProfile({ env: {} });
    assert.ok(profile.ramGb > 0);
    assert.ok(profile.cpuCores > 0);
    assert.ok(profile.probedAt);
  });
});
