import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contextModeRequiresLocalContext,
  isCloudRouteAllowedForContext,
  validateLocalRtxRequired,
  validateProviderContextCombination,
  validateResolvedRouteForContext,
} from "./privacyGuard";
import { AiRouterError, LOCAL_ONLY_CONTEXT_MODES } from "./types";
import { AiPrivacyError } from "../types";

describe("mail privacy", () => {
  it("mail is not cloud-allowed", () => {
    assert.equal(isCloudRouteAllowedForContext("mail"), false);
  });

  it("mail is a local-only context mode", () => {
    assert.equal(contextModeRequiresLocalContext("mail"), true);
    assert.ok(LOCAL_ONLY_CONTEXT_MODES.includes("mail"));
  });

  it("blocks cloud provider with mail context", () => {
    assert.throws(
      () => validateProviderContextCombination("cloud", "mail"),
      AiPrivacyError,
    );
  });

  it("blocks resolved cloud route for mail (second line of defense)", () => {
    assert.throws(
      () => validateResolvedRouteForContext("cloud", "mail"),
      AiPrivacyError,
    );
  });

  it("allows resolved local_rtx route for mail", () => {
    assert.doesNotThrow(() => validateResolvedRouteForContext("local_rtx", "mail"));
  });

  it("requires RTX when auto + mail and RTX is offline (no cloud fallback)", () => {
    assert.throws(
      () => validateLocalRtxRequired("auto", "mail", false),
      AiRouterError,
    );
  });

  it("allows auto + mail when RTX is online", () => {
    assert.doesNotThrow(() => validateLocalRtxRequired("auto", "mail", true));
  });
});
