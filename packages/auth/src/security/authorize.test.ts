import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { authorize, hasCloudflareAccessAuth } from "./authorize";

function makeRequest(
  pathname: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://uweanddragons.org${pathname}`, { headers });
}

describe("authorize", () => {
  afterEach(() => {
    delete process.env.STUDIO_API_TOKEN;
    delete process.env.STUDIO_ACCESS_ALLOWED_EMAILS;
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

  it("blocks protected studio API without auth when token is configured", () => {
    process.env.STUDIO_API_TOKEN = "secret-token";

    const denied = authorize({
      scope: "studio-api",
      request: makeRequest("/api/brain/run", { host: "uweanddragons.org" }),
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
        host: "uweanddragons.org",
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
        host: "uweanddragons.org",
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
        authorization: "Bearer secret-token",
      }),
      pathname: "/api/brain/run",
    });
    assert.ok(denied);
    assert.equal(denied?.status, 403);
  });

  it("rejects Cloudflare Access when allowlist env is unset", () => {
    assert.equal(
      hasCloudflareAccessAuth(
        makeRequest("/", {
          "cf-access-authenticated-user-email": "anyone@example.com",
        }),
      ),
      false,
    );
  });

  it("accepts Cloudflare Access authenticated user", () => {
    process.env.STUDIO_ACCESS_ALLOWED_EMAILS = "lasset610@gmail.com";

    assert.equal(
      hasCloudflareAccessAuth(
        makeRequest("/", {
          "cf-access-authenticated-user-email": "lasset610@gmail.com",
        }),
      ),
      true,
    );

    const denied = authorize({
      scope: "studio-api",
      request: makeRequest("/api/import/execute", {
        host: "uweanddragons.org",
        "cf-access-authenticated-user-email": "lasset610@gmail.com",
      }),
      pathname: "/api/import/execute",
    });
    assert.equal(denied, null);
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
