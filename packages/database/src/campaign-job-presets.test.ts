import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CAMPAIGN_JOB_PRESETS,
  resolveCampaignPresetHref,
} from "./campaign-job-presets";

describe("campaign job presets", () => {
  it("defines core campaign presets", () => {
    assert.ok(CAMPAIGN_JOB_PRESETS.length >= 5);
    assert.ok(CAMPAIGN_JOB_PRESETS.some((preset) => preset.jobType === "canon_check"));
    assert.ok(
      CAMPAIGN_JOB_PRESETS.some(
        (preset) => preset.brainActionId === "next_session_prep",
      ),
    );
  });

  it("resolves world slug in preset href", () => {
    const preset = CAMPAIGN_JOB_PRESETS.find((entry) => entry.href?.includes("{worldSlug}"));
    assert.ok(preset?.href);
    assert.equal(
      resolveCampaignPresetHref(preset, "terra"),
      preset.href!.replace("{worldSlug}", "terra"),
    );
  });
});
