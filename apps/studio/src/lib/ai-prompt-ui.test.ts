import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computePromptUiState,
  deriveStatusChips,
  HINT_BRAIN_LOCAL_ONLY,
  HINT_CLOUD_NO_BRAIN,
  HINT_LOCAL_NOT_READY,
  requiresLocalContext,
  resolveContextSelection,
  type AiPromptCapabilities,
} from "./ai-prompt-ui";

function baseCaps(overrides: Partial<AiPromptCapabilities> = {}): AiPromptCapabilities {
  const rtxEnabled = overrides.rtxEnabled ?? true;
  const rtxOnline = overrides.rtxOnline ?? true;
  const rtxState =
    overrides.rtxState ??
    (!rtxEnabled ? "disabled" : rtxOnline ? "online" : "offline");

  return {
    rtxEnabled,
    rtxOnline,
    localAiReady: overrides.localAiReady ?? rtxOnline,
    cloudAvailable: true,
    brainLocal: true,
    hasCurrentObject: true,
    ...overrides,
    rtxState,
  };
}

describe("ai-prompt-ui — privacy gating", () => {
  it("disables brain context options when cloud provider is selected", () => {
    const ui = computePromptUiState("cloud", "general_chat", baseCaps(), "Hallo");

    for (const mode of ["brain", "current_object", "current_object_plus_brain"] as const) {
      const option = ui.contextOptions.find((entry) => entry.id === mode);
      assert.ok(option?.disabled, `${mode} must be disabled for cloud`);
      assert.equal(option?.disabledReason, HINT_CLOUD_NO_BRAIN);
    }

    const general = ui.contextOptions.find((entry) => entry.id === "general_chat");
    assert.equal(general?.disabled, false);
    assert.ok(ui.hints.includes(HINT_CLOUD_NO_BRAIN));
  });

  it("disables brain context when RTX is offline in auto mode", () => {
    const caps = baseCaps({
      rtxState: "offline",
      rtxOnline: false,
      localAiReady: false,
    });

    const ui = computePromptUiState("auto", "general_chat", caps, "Frage");

    for (const mode of ["brain", "current_object", "current_object_plus_brain"] as const) {
      const option = ui.contextOptions.find((entry) => entry.id === mode);
      assert.ok(option?.disabled, `${mode} must be disabled when RTX offline`);
      assert.equal(option?.disabledReason, HINT_BRAIN_LOCAL_ONLY);
    }
  });

  it("allows general chat with cloud when cloud is available", () => {
    const ui = computePromptUiState(
      "cloud",
      "general_chat",
      baseCaps({ rtxState: "offline", rtxOnline: false, localAiReady: false }),
      "Erkläre mir Initiative in DnD",
    );

    assert.equal(ui.canSend, true);
    assert.equal(ui.sendBlockedReason, undefined);
  });

  it("blocks send with understandable error when local_rtx is offline", () => {
    const ui = computePromptUiState(
      "local_rtx",
      "general_chat",
      baseCaps({ rtxState: "offline", localAiReady: false, rtxOnline: false }),
      "Test",
    );

    assert.equal(ui.canSend, false);
    assert.equal(ui.sendBlockedReason, HINT_LOCAL_NOT_READY);
  });

  it("blocks auto + brain when RTX offline even if cloud is available", () => {
    const ui = computePromptUiState(
      "auto",
      "brain",
      baseCaps({
        rtxState: "offline",
        localAiReady: false,
        rtxOnline: false,
        cloudAvailable: true,
      }),
      "Brain-Frage",
    );

    assert.equal(ui.canSend, false);
    assert.equal(ui.sendBlockedReason, HINT_BRAIN_LOCAL_ONLY);
  });

  it("resolveContextSelection falls back to general_chat when brain becomes unavailable", () => {
    const next = resolveContextSelection(
      "brain",
      "cloud",
      baseCaps({ cloudAvailable: true }),
    );
    assert.equal(next, "general_chat");
  });

  it("requiresLocalContext identifies protected modes", () => {
    assert.equal(requiresLocalContext("general_chat"), false);
    assert.equal(requiresLocalContext("brain"), true);
    assert.equal(requiresLocalContext("current_object"), true);
    assert.equal(requiresLocalContext("current_object_plus_brain"), true);
  });

  it("deriveStatusChips reflects RTX offline and cloud availability", () => {
    const chips = deriveStatusChips(
      baseCaps({ rtxState: "offline", rtxOnline: false, localAiReady: false, cloudAvailable: false }),
    );

    const rtx = chips.find((chip) => chip.id === "rtx");
    const cloud = chips.find((chip) => chip.id === "cloud");
    assert.equal(rtx?.value, "offline");
    assert.equal(rtx?.level, "error");
    assert.equal(cloud?.value, "nicht konfiguriert");
  });
});
