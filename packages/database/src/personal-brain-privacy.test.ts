import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertPersonalBrainLocalOnly,
  isPersonalBrainContextAllowedForProvider,
  PERSONAL_BRAIN_ALLOWED_PROVIDER_MODES,
} from "./personal-brain-privacy";

/**
 * These cases used to guard the local-vs-cloud split for Life-Brain content.
 * Cloud providers were removed, so "may this leave the host?" now has one answer
 * for everything. What the guard still earns its keep for is the narrower
 * question it always also answered: an unknown provider string must not slip
 * through unnoticed.
 */
describe("personal-brain-privacy", () => {
  it("names local_rtx as the only provider mode", () => {
    assert.deepEqual([...PERSONAL_BRAIN_ALLOWED_PROVIDER_MODES], ["local_rtx"]);
  });

  it("allows the local provider", () => {
    assert.equal(isPersonalBrainContextAllowedForProvider("local_rtx"), true);
    assert.doesNotThrow(() => assertPersonalBrainLocalOnly("local_rtx"));
  });

  it("rejects every other provider string, including the retired cloud modes", () => {
    for (const provider of ["cloud", "auto", "openai", "CLOUD", ""]) {
      assert.equal(
        isPersonalBrainContextAllowedForProvider(provider),
        false,
        `${provider || "(empty)"} must not be accepted`,
      );
      assert.throws(() => assertPersonalBrainLocalOnly(provider), /RTX-Host/);
    }
  });
});
