import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertInferenceEndpointUrlAllowed,
  estimateHardwareFit,
} from "./inference-endpoint-service";

describe("inference-endpoint-service", () => {
  it("blocks public inference URLs", () => {
    assert.throws(() => assertInferenceEndpointUrlAllowed("https://ollama.example.com"));
  });

  it("allows private inference URLs", () => {
    assert.doesNotThrow(() => assertInferenceEndpointUrlAllowed("http://192.168.1.10:11434"));
  });

  it("estimates hardware fit", () => {
    assert.equal(estimateHardwareFit(32, 8).fits, true);
    assert.equal(estimateHardwareFit(8, 16).fits, false);
  });
});
