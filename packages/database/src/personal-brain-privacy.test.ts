import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertPersonalBrainLocalOnly,
  isPersonalBrainContextAllowedForProvider,
  PERSONAL_BRAIN_ALLOWED_PROVIDER_MODES,
} from "./personal-brain-privacy";

describe("personal-brain-privacy", () => {
  it("defines the allowed provider set explicitly (local_rtx/auto yes, cloud no)", () => {
    assert.deepEqual([...PERSONAL_BRAIN_ALLOWED_PROVIDER_MODES], ["local_rtx", "auto"]);
  });

  it("allows only local-resolving providers for personal brain context", () => {
    assert.equal(isPersonalBrainContextAllowedForProvider("local_rtx"), true);
    // auto is safe: the AI router never resolves personal_brain to cloud.
    assert.equal(isPersonalBrainContextAllowedForProvider("auto"), true);
    assert.equal(isPersonalBrainContextAllowedForProvider("cloud"), false);
  });

  it("assert is consistent with the allow-list (no separate string compare)", () => {
    assert.doesNotThrow(() => assertPersonalBrainLocalOnly("local_rtx"));
    assert.doesNotThrow(() => assertPersonalBrainLocalOnly("auto"));
    assert.throws(() => assertPersonalBrainLocalOnly("cloud"), /lokale KI/);
  });

  it("rejects unknown provider strings instead of silently allowing them", () => {
    assert.throws(() => assertPersonalBrainLocalOnly("openai"), /lokale KI/);
    assert.throws(() => assertPersonalBrainLocalOnly("CLOUD"), /lokale KI/);
    assert.throws(() => assertPersonalBrainLocalOnly(""), /lokale KI/);
    assert.equal(isPersonalBrainContextAllowedForProvider("openai"), false);
  });
});
