import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveImageProviderConfig } from "./index";

describe("resolveImageProviderConfig", () => {
  it("disables cloud by default", () => {
    const config = resolveImageProviderConfig({});
    assert.equal(config.allowCloud, false);
    assert.equal(config.enabled, true);
  });

  it("prefers RTX_BASE_URL and RTX_SERVICE_TOKEN over legacy agent env names", () => {
    const config = resolveImageProviderConfig({
      RTX_BASE_URL: "http://192.168.1.10:8765",
      RTX_SERVICE_TOKEN: "secret",
      RTX_AGENT_URL: "http://legacy:9999",
      RTX_AGENT_TOKEN: "legacy",
    });
    assert.equal(config.rtxAgentUrl, "http://192.168.1.10:8765");
    assert.equal(config.rtxAgentToken, "secret");
    assert.equal(config.useConnectorImage, false);
  });

  it("enables connector image routing when RTX_USE_CONNECTOR_IMAGE=true", () => {
    const config = resolveImageProviderConfig({ RTX_USE_CONNECTOR_IMAGE: "true" });
    assert.equal(config.useConnectorImage, true);
  });
});
