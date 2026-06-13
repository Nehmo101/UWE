import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkRateLimit, clientIpFromHeaders, resetRateLimit } from "./rate-limit";

describe("rate limiter", () => {
  it("allows attempts below the limit", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i += 1) {
      const result = checkRateLimit(key, { maxAttempts: 5, windowMs: 60_000 });
      assert.equal(result.allowed, true);
    }
  });

  it("blocks once the limit is reached and reports retry-after", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i += 1) {
      checkRateLimit(key, { maxAttempts: 3, windowMs: 60_000 });
    }

    const blocked = checkRateLimit(key, { maxAttempts: 3, windowMs: 60_000 });
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds >= 1);
  });

  it("isolates limits per key", () => {
    const keyA = `test-${Math.random()}`;
    const keyB = `test-${Math.random()}`;

    for (let i = 0; i < 3; i += 1) {
      checkRateLimit(keyA, { maxAttempts: 3, windowMs: 60_000 });
    }

    assert.equal(checkRateLimit(keyA, { maxAttempts: 3, windowMs: 60_000 }).allowed, false);
    assert.equal(checkRateLimit(keyB, { maxAttempts: 3, windowMs: 60_000 }).allowed, true);
  });

  it("resets a key after successful authentication", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i += 1) {
      checkRateLimit(key, { maxAttempts: 3, windowMs: 60_000 });
    }
    assert.equal(checkRateLimit(key, { maxAttempts: 3, windowMs: 60_000 }).allowed, false);

    resetRateLimit(key);
    assert.equal(checkRateLimit(key, { maxAttempts: 3, windowMs: 60_000 }).allowed, true);
  });

  it("extracts the client IP from forwarded headers when TRUST_PROXY is enabled", () => {
    const previous = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = "true";

    try {
      const forwarded = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
      assert.equal(clientIpFromHeaders(forwarded), "203.0.113.7");

      const realIp = new Headers({ "x-real-ip": "198.51.100.2" });
      assert.equal(clientIpFromHeaders(realIp), "198.51.100.2");
    } finally {
      if (previous === undefined) {
        delete process.env.TRUST_PROXY;
      } else {
        process.env.TRUST_PROXY = previous;
      }
    }
  });

  it("ignores forwarded headers when TRUST_PROXY is disabled", () => {
    const previous = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = "false";

    try {
      const forwarded = new Headers({ "x-forwarded-for": "203.0.113.7" });
      assert.equal(clientIpFromHeaders(forwarded), "unknown");
      assert.equal(clientIpFromHeaders(new Headers()), "unknown");
    } finally {
      if (previous === undefined) {
        delete process.env.TRUST_PROXY;
      } else {
        process.env.TRUST_PROXY = previous;
      }
    }
  });
});
