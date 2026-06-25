import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AiPrivacyError } from "../types";
import {
  contextModeRequiresLocalContext,
  isCloudRouteAllowedForContext,
  validateLocalRtxRequired,
  validateProviderContextCombination,
  validateResolvedRouteForContext,
} from "./privacyGuard";
import { AiRouterError, LOCAL_ONLY_CONTEXT_MODES } from "./types";

describe("personal_brain privacy", () => {
  it("personal_brain is not cloud-allowed", () => {
    assert.equal(isCloudRouteAllowedForContext("personal_brain"), false);
  });

  it("personal_brain is a local-only context mode", () => {
    assert.equal(contextModeRequiresLocalContext("personal_brain"), true);
    assert.ok(LOCAL_ONLY_CONTEXT_MODES.includes("personal_brain"));
  });

  it("blocks cloud provider with personal_brain context", () => {
    assert.throws(
      () => validateProviderContextCombination("cloud", "personal_brain"),
      AiPrivacyError,
    );
  });

  it("blocks resolved cloud route for personal_brain (second line of defense)", () => {
    assert.throws(
      () => validateResolvedRouteForContext("cloud", "personal_brain"),
      AiPrivacyError,
    );
  });

  it("allows resolved local_rtx route for personal_brain", () => {
    assert.doesNotThrow(() => validateResolvedRouteForContext("local_rtx", "personal_brain"));
  });

  it("requires RTX when auto + personal_brain and RTX is offline", () => {
    assert.throws(
      () => validateLocalRtxRequired("auto", "personal_brain", false),
      (error: unknown) => {
        assert.ok(error instanceof AiRouterError);
        assert.match(error.message, /Cloud-Fallback ist aus Datenschutzgründen nicht erlaubt/);
        return true;
      },
    );
  });

  it("requires RTX when local_rtx + personal_brain and RTX is offline", () => {
    assert.throws(
      () => validateLocalRtxRequired("local_rtx", "personal_brain", false),
      AiRouterError,
    );
  });

  it("allows local_rtx + personal_brain when RTX is online", () => {
    assert.doesNotThrow(() => validateLocalRtxRequired("local_rtx", "personal_brain", true));
  });
});
