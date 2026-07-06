import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveImageProviderConfig } from "./index";

describe("resolveImageProviderConfig", () => {
  it("disables cloud by default", () => {
    const config = resolveImageProviderConfig({});
    assert.equal(config.allowCloud, false);
    assert.equal(config.enabled, true);
  });

  it("defaults connector image routing on unless RTX_USE_CONNECTOR_IMAGE=false", () => {
    const config = resolveImageProviderConfig({});
    assert.equal(config.useConnectorImage, true);
    const disabled = resolveImageProviderConfig({ RTX_USE_CONNECTOR_IMAGE: "false" });
    assert.equal(disabled.useConnectorImage, false);
  });
});
