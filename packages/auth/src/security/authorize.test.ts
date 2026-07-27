import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { authorize } from "./authorize";

function makeRequest(
  pathname: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://uwe.example${pathname}`, { headers });
}

describe("authorize", () => {
  afterEach(() => {
    delete process.env.STUDIO_API_TOKEN;
  });

  it("allows public portal API routes without session", () => {
    const denied = authorize({
      scope: "portal-api",
      request: makeRequest("/api/health"),
      pathname: "/api/health",
      hasSession: false,
    });
    assert.equal(denied, null);
  });

  it("blocks unknown portal API routes", () => {
    const denied = authorize({
      scope: "portal-api",
      request: makeRequest("/api/unknown"),
      pathname: "/api/unknown",
      hasSession: false,
    });
    assert.ok(denied);
    assert.equal(denied?.status, 404);
  });

  it("allows public studio auth routes without bearer token when STUDIO_API_TOKEN is configured", () => {
    process.env.STUDIO_API_TOKEN = "secret-token";

    for (const pathname of ["/setup", "/api/auth/setup"]) {
      const denied = authorize({
        scope: pathname.startsWith("/api/") ? "studio-api" : "studio-action",
        request: makeRequest(pathname, { host: "127.0.0.1:3000" }),
        pathname,
      });
      assert.equal(denied, null, pathname);
    }

    delete process.env.STUDIO_API_TOKEN;
  });

  it("blocks protected studio API without auth when token is configured", () => {
    process.env.STUDIO_API_TOKEN = "secret-token";

    const denied = authorize({
      scope: "studio-api",
      request: makeRequest("/api/brain/run", { host: "uwe.example" }),
      pathname: "/api/brain/run",
    });
    assert.ok(denied);
    assert.equal(denied?.status, 401);
  });

  it("allows studio API with bearer token", () => {
    process.env.STUDIO_API_TOKEN = "secret-token";

    const denied = authorize({
      scope: "studio-api",
      request: makeRequest("/api/brain/run", {
        host: "uwe.example",
        authorization: "Bearer secret-token",
      }),
      pathname: "/api/brain/run",
    });
    assert.equal(denied, null);
  });

  it("blocks cross-site studio requests even with token", () => {
    process.env.STUDIO_API_TOKEN = "secret-token";

    const denied = authorize({
      scope: "studio-api",
      request: makeRequest("/api/brain/run", {
        host: "uwe.example",
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
        authorization: "Bearer secret-token",
      }),
      pathname: "/api/brain/run",
    });
    assert.ok(denied);
    assert.equal(denied?.status, 403);
  });

  it("ignores the Cloudflare Access header — UWE login is the sole auth", () => {
    process.env.STUDIO_API_TOKEN = "secret-token";

    // A cf-access-authenticated-user-email header must no longer bypass auth.
    const denied = authorize({
      scope: "studio-api",
      request: makeRequest("/api/import/execute", {
        host: "uwe.example",
        "cf-access-authenticated-user-email": "owner@uwe.example",
      }),
      pathname: "/api/import/execute",
    });
    assert.ok(denied);
    assert.equal(denied?.status, 401);
  });

  it("does not let the Cloudflare Access header override the cross-site guard", () => {
    process.env.STUDIO_API_TOKEN = "secret-token";

    const denied = authorize({
      scope: "studio-api",
      request: makeRequest("/api/import/execute", {
        host: "studio.uwe.example",
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
        "cf-access-authenticated-user-email": "owner@uwe.example",
      }),
      pathname: "/api/import/execute",
    });
    assert.ok(denied);
    assert.equal(denied?.status, 403);
  });

  it("requires portal session for auth routes", () => {
    const denied = authorize({
      scope: "portal-session",
      request: makeRequest("/auth/worlds/terra"),
      pathname: "/auth/worlds/terra",
      hasSession: false,
    });
    assert.ok(denied);
    assert.equal(denied?.status, 401);
  });
});
