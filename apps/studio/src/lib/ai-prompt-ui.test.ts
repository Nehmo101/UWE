import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computePromptUiState,
  deriveStatusChips,
  HINT_CLOUD_NO_BRAIN,
  HINT_LOCAL_NOT_READY,
  HINT_PERSONAL_BRAIN_LOCAL_ONLY,
  requiresLocalContext,
  resolveContextSelection,
  sanitizeAiErrorMessage,
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
  it("allows DnD context options when cloud provider is selected (W0 policy)", () => {
    const ui = computePromptUiState("cloud", "general_chat", baseCaps(), "Hallo");

    for (const mode of ["brain", "current_object", "current_object_plus_brain"] as const) {
      const option = ui.contextOptions.find((entry) => entry.id === mode);
      assert.equal(option?.disabled, false, `${mode} must stay enabled for cloud under W0`);
    }

    const personal = ui.contextOptions.find((entry) => entry.id === "personal_brain");
    assert.ok(personal?.disabled, "personal_brain must stay cloud-blocked");
    assert.equal(personal?.disabledReason, HINT_PERSONAL_BRAIN_LOCAL_ONLY);
  });

  it("allows DnD brain context when RTX is offline in auto mode if cloud is available", () => {
    const caps = baseCaps({
      rtxState: "offline",
      rtxOnline: false,
      localAiReady: false,
      cloudAvailable: true,
    });

    const ui = computePromptUiState("auto", "brain", caps, "Frage");

    const brain = ui.contextOptions.find((entry) => entry.id === "brain");
    assert.equal(brain?.disabled, false);
    assert.equal(ui.canSend, true);
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

  it("allows auto + brain when RTX offline if cloud is available (W0 policy)", () => {
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

    assert.equal(ui.canSend, true);
    assert.equal(ui.sendBlockedReason, undefined);
  });

  it("blocks auto + personal_brain when RTX offline even if cloud is available", () => {
    const ui = computePromptUiState(
      "auto",
      "personal_brain",
      baseCaps({
        rtxState: "offline",
        localAiReady: false,
        rtxOnline: false,
        cloudAvailable: true,
      }),
      "Life-Brain-Frage",
    );

    assert.equal(ui.canSend, false);
    assert.equal(ui.sendBlockedReason, HINT_PERSONAL_BRAIN_LOCAL_ONLY);
  });

  it("resolveContextSelection falls back to general_chat when personal_brain becomes unavailable", () => {
    const next = resolveContextSelection(
      "personal_brain",
      "cloud",
      baseCaps({ cloudAvailable: true }),
    );
    assert.equal(next, "general_chat");
  });

  it("requiresLocalContext identifies only personal_brain as hard-local", () => {
    assert.equal(requiresLocalContext("general_chat"), false);
    assert.equal(requiresLocalContext("brain"), false);
    assert.equal(requiresLocalContext("current_object"), false);
    assert.equal(requiresLocalContext("current_object_plus_brain"), false);
    assert.equal(requiresLocalContext("personal_brain"), true);
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

  it("sanitizeAiErrorMessage maps Ollama HTTP errors to user hints", () => {
    assert.match(
      sanitizeAiErrorMessage("Ollama chat HTTP 404"),
      /Ollama\/LM Studio/i,
    );
  });

  it("shows cloud fallback hint for DnD context when RTX offline in auto mode", () => {
    const ui = computePromptUiState(
      "auto",
      "current_object_plus_brain",
      baseCaps({
        rtxState: "offline",
        localAiReady: false,
        rtxOnline: false,
        cloudAvailable: true,
      }),
      "Frage",
    );

    assert.ok(
      ui.hints.some((hint) => hint.includes("Cloud-Fallback")),
      "expected cloud fallback hint for DnD context",
    );
  });

  it("blocks cloud + personal_brain with dedicated hint", () => {
    const ui = computePromptUiState(
      "cloud",
      "personal_brain",
      baseCaps(),
      "Frage",
    );

    const option = ui.contextOptions.find((entry) => entry.id === "personal_brain");
    assert.equal(option?.disabledReason, HINT_PERSONAL_BRAIN_LOCAL_ONLY);
    assert.ok(ui.hints.includes(HINT_CLOUD_NO_BRAIN));
  });
});
