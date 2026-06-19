import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertPersonalBrainLocalOnly,
  isPersonalBrainContextAllowedForProvider,
} from "./personal-brain-privacy";

describe("personal-brain-privacy", () => {
  it("allows only local providers for personal brain context", () => {
    assert.equal(isPersonalBrainContextAllowedForProvider("local_rtx"), true);
    assert.equal(isPersonalBrainContextAllowedForProvider("cloud"), false);
    assert.equal(isPersonalBrainContextAllowedForProvider("auto"), false);
  });

  it("blocks cloud provider for life-brain context API", () => {
    assert.throws(() => assertPersonalBrainLocalOnly("cloud"), /lokale KI/);
    assert.doesNotThrow(() => assertPersonalBrainLocalOnly("local_rtx"));
  });
});
