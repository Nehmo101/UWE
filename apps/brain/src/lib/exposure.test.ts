import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isBrainEntryEnabled,
  resolveBrainBindHostname,
  resolveBrainExposure,
} from "./exposure";

describe("brain exposure policy", () => {
  it("defaults to loopback and never to a public value", () => {
    assert.equal(resolveBrainExposure({}), "loopback");
    assert.equal(resolveBrainExposure({ BRAIN_EXPOSURE: "public" }), "loopback");
    assert.equal(resolveBrainExposure({ BRAIN_EXPOSURE: "on" }), "loopback");
    assert.equal(resolveBrainExposure({ BRAIN_EXPOSURE: "lan" }), "lan");
    assert.equal(resolveBrainExposure({ BRAIN_EXPOSURE: "off" }), "off");
  });

  it("binds to loopback except for an explicit LAN interface — never all-interfaces", () => {
    assert.equal(resolveBrainBindHostname("loopback"), "127.0.0.1");
    assert.equal(resolveBrainBindHostname("off"), "127.0.0.1");
    assert.equal(resolveBrainBindHostname("lan"), "127.0.0.1"); // lan without a host stays loopback
    assert.equal(resolveBrainBindHostname("lan", "192.168.1.10"), "192.168.1.10");
    // A public/all-interfaces bind is refused even when asked for.
    assert.equal(resolveBrainBindHostname("lan", "0.0.0.0"), "127.0.0.1");
    assert.equal(resolveBrainBindHostname("lan", "::"), "127.0.0.1");
  });

  it("is enabled unless turned off", () => {
    assert.equal(isBrainEntryEnabled("loopback"), true);
    assert.equal(isBrainEntryEnabled("lan"), true);
    assert.equal(isBrainEntryEnabled("off"), false);
  });
});
