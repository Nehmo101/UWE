import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkStudioRateLimit, SENSITIVE_STUDIO_RATE_LIMIT } from "./studio-rate-limit";

describe("studio rate limiter", () => {
  it("allows requests under the limit", () => {
    const key = `test:${Date.now()}`;
    const result = checkStudioRateLimit(key, SENSITIVE_STUDIO_RATE_LIMIT);
    assert.equal(result.allowed, true);
  });

  it("blocks after max attempts", () => {
    const key = `block:${Date.now()}`;
    for (let i = 0; i < SENSITIVE_STUDIO_RATE_LIMIT.maxAttempts; i++) {
      checkStudioRateLimit(key, SENSITIVE_STUDIO_RATE_LIMIT);
    }
    const blocked = checkStudioRateLimit(key, SENSITIVE_STUDIO_RATE_LIMIT);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds > 0);
  });
});
