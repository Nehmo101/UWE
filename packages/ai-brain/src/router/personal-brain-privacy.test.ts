import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCloudRouteAllowedForContext,
  validateProviderContextCombination,
} from "./privacyGuard";
import { AiPrivacyError } from "../types";

describe("personal_brain privacy", () => {
  it("personal_brain is not cloud-allowed", () => {
    assert.equal(isCloudRouteAllowedForContext("personal_brain"), false);
  });

  it("blocks cloud provider with personal_brain context", () => {
    assert.throws(
      () => validateProviderContextCombination("cloud", "personal_brain"),
      AiPrivacyError,
    );
  });
});
