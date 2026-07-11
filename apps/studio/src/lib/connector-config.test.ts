import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveHostConnectorConfig } from "./connector-config";

describe("resolveHostConnectorConfig", () => {
  it("keeps queue and direct transports enabled by default", () => {
    const config = resolveHostConnectorConfig({ NODE_ENV: "test" });

    assert.equal(config.queueEnabled, true);
    assert.equal(config.directEnabled, true);
  });

  it("controls queue and direct transports independently", () => {
    const queueDisabled = resolveHostConnectorConfig({
      NODE_ENV: "test",
      UWE_HOST_QUEUE_DISABLED: "true",
    });
    const directDisabled = resolveHostConnectorConfig({
      NODE_ENV: "test",
      UWE_HOST_CONNECTOR_DIRECT_DISABLED: " TRUE ",
    });

    assert.equal(queueDisabled.queueEnabled, false);
    assert.equal(queueDisabled.directEnabled, true);
    assert.equal(directDisabled.queueEnabled, true);
    assert.equal(directDisabled.directEnabled, false);
  });
});
