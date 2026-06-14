import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveImageProviderConfig } from "./index";

describe("resolveImageProviderConfig", () => {
  it("disables cloud by default", () => {
    const config = resolveImageProviderConfig({});
    assert.equal(config.allowCloud, false);
    assert.equal(config.enabled, true);
  });
});
