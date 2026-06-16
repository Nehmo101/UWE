import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { z } from "zod";
import {
  guardStudioMutation,
  loginBodySchema,
  parseBody,
  requirePortalApiAuth,
  requirePortalReadAuth,
  requireStudioApiAuth,
  resetRateLimitStore,
} from "@uwe/security";

describe("API security acceptance criteria", () => {
  afterEach(() => {
    delete process.env.STUDIO_API_TOKEN;
    resetRateLimitStore();
  });

  it("invalid body -> 400", async () => {
    const request = new Request("http://portal.local/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", password: "" }),
      headers: {
        "Content-Type": "application/json",
        "sec-fetch-site": "same-origin",
        host: "portal.local",
      },
    });

    const parsed = await parseBody(request, loginBodySchema);
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(parsed.response.status, 400);
    }
  });

  it("unauthenticated -> 401 when studio token required", () => {
    process.env.STUDIO_API_TOKEN = "secret-token";

    const result = requireStudioApiAuth(
      new Request("http://studio.local/api/settings", {
        method: "PUT",
        headers: { host: "studio.local" },
      }),
    );

    assert.ok(result);
    assert.equal(result.status, 401);
  });

  it("forbidden -> 403 for cross-origin studio requests", () => {
    const result = guardStudioMutation(
      new Request("http://studio.local/api/backup", {
        method: "POST",
        headers: {
          "sec-fetch-site": "cross-site",
          host: "studio.local",
        },
      }),
    );

    assert.ok(result);
    assert.equal(result.status, 403);
  });

  it("too many requests -> 429", () => {
    const request = new Request("http://studio.local/api/ai/generate", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin", host: "studio.local" },
    });

    for (let i = 0; i < 30; i += 1) {
      assert.equal(guardStudioMutation(request, { rateLimit: "ai" }), null);
    }

    const blocked = guardStudioMutation(request, { rateLimit: "ai" });
    assert.ok(blocked);
    assert.equal(blocked!.status, 429);
    assert.ok(blocked!.headers.get("Retry-After"));
  });

  it("CSRF missing -> blocked for portal mutating requests", () => {
    const result = requirePortalApiAuth(
      new Request("http://portal.local/api/auth/logout", {
        method: "POST",
        headers: {
          origin: "http://evil.example",
          host: "portal.local",
        },
      }),
    );

    assert.ok(result);
    assert.equal(result.status, 403);
  });

  it("protected API rejects foreign Origin on read", () => {
    const result = requirePortalReadAuth(
      new Request("http://portal.local/api/worlds/demo/graph", {
        method: "GET",
        headers: {
          origin: "http://evil.example",
          host: "portal.local",
        },
      }),
    );

    assert.ok(result);
    assert.equal(result.status, 403);
  });

  it("parseParams rejects empty slugs", async () => {
    const result = await parseBody(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
      z.object({ worldSlug: z.string().min(1) }),
    );

    assert.equal(result.success, false);
  });
});
