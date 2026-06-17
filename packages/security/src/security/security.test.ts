import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { z } from "zod";
import { isCrossSiteBrowserRequest, requireSameOriginMutation } from "./csrf";
import { validationError } from "./errors";
import { guardStudioMutation, requireStudioApiAuth } from "./guards";
import {
  enforceRateLimit,
  resetRateLimitStore,
  setRateLimitStore,
  type RateLimitStore,
} from "./rate-limit";
import { parseBody, parseParams, parseQuery } from "./validate";

describe("validate helpers", () => {
  it("parseBody returns 400 for invalid JSON", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });

    const result = await parseBody(request, z.object({ name: z.string() }));
    assert.equal(result.success, false);
    assert.equal(result.response.status, 400);
  });

  it("parseBody returns 400 for schema violations", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email" }),
      headers: { "Content-Type": "application/json" },
    });

    const result = await parseBody(
      request,
      z.object({ email: z.string().email() }),
    );
    assert.equal(result.success, false);
    assert.equal(result.response.status, 400);
  });

  it("parseParams validates route params", async () => {
    const result = await parseParams(
      Promise.resolve({ worldSlug: "my-world" }),
      z.object({ worldSlug: z.string().min(1) }),
    );
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.worldSlug, "my-world");
    }
  });

  it("parseQuery validates search params", () => {
    const result = parseQuery(
      "http://localhost/api/search?q=hello",
      z.object({ q: z.string().min(2) }),
    );
    assert.equal(result.success, true);
  });
});

describe("CSRF protection", () => {
  it("blocks cross-site mutating requests", () => {
    const request = new Request("http://studio.local/api/backup", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site", host: "studio.local" },
    });

    const blocked = requireSameOriginMutation(request);
    assert.ok(blocked);
    assert.equal(blocked.status, 403);
  });

  it("allows same-origin mutating requests", () => {
    const request = new Request("http://studio.local/api/backup", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin", host: "studio.local" },
    });

    assert.equal(requireSameOriginMutation(request), null);
  });

  it("detects foreign Origin headers", () => {
    const request = new Request("http://studio.local/api/backup", {
      method: "POST",
      headers: { origin: "http://evil.example", host: "studio.local" },
    });

    assert.equal(isCrossSiteBrowserRequest(request), true);
  });
});

describe("studio API guard", () => {
  afterEach(() => {
    delete process.env.STUDIO_API_TOKEN;
  });

  it("returns 403 for cross-site requests", () => {
    const result = requireStudioApiAuth(
      new Request("http://studio.local/api/backup", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site", host: "studio.local" },
      }),
    );
    assert.ok(result);
    assert.equal(result!.status, 403);
  });

  it("returns 401 when token is required but missing", () => {
    process.env.STUDIO_API_TOKEN = "secret";

    const result = requireStudioApiAuth(
      new Request("http://studio.local/api/backup", {
        method: "POST",
        headers: { host: "studio.local" },
      }),
    );
    assert.ok(result);
    assert.equal(result.status, 401);
  });

  it("returns 429 when rate limited", () => {
    const request = new Request("http://studio.local/api/ai/generate", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin", host: "studio.local" },
    });

    for (let i = 0; i < 30; i += 1) {
      const allowed = guardStudioMutation(request, { rateLimit: "ai" });
      assert.equal(allowed, null);
    }

    const result = guardStudioMutation(request, { rateLimit: "ai" });
    assert.ok(result);
    assert.equal(result.status, 429);
  });
});

describe("rate limiter store", () => {
  afterEach(() => {
    resetRateLimitStore();
  });
  it("supports custom stores for future Redis backends", () => {
    const calls: string[] = [];
    const fakeStore: RateLimitStore = {
      check(key) {
        calls.push(key);
        return { allowed: false, retryAfterSeconds: 42 };
      },
      reset() {},
    };

    setRateLimitStore(fakeStore);
    const response = enforceRateLimit(
      new Request("http://localhost/api"),
      "test",
      "login",
    );
    assert.ok(response);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "42");
    assert.deepEqual(calls, ["test:unknown"]);
  });
});

describe("error responses", () => {
  it("validation errors do not expose stack traces", async () => {
    const response = validationError(
      z.object({ x: z.string() }).safeParse({}).error!,
    );
    const body = (await response.json()) as { error: string };
    assert.equal(response.status, 400);
    assert.ok(!JSON.stringify(body).includes("stack"));
  });
});
