import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

describe("studio middleware deny-by-default", () => {
  afterEach(() => {
    delete process.env.STUDIO_API_TOKEN;
    delete process.env.AUTH_REQUIRED;
    delete process.env.PUBLIC_APP_URL;
    delete process.env.CLOUDFLARE_TUNNEL;
  });

  it("allows GET /setup without Authorization when STUDIO_API_TOKEN is set", () => {
    process.env.STUDIO_API_TOKEN = "host-setup-token";
    process.env.AUTH_REQUIRED = "true";
    process.env.PUBLIC_APP_URL = "https://uwe.example";

    const request = new NextRequest("http://127.0.0.1:3000/setup", {
      headers: { host: "127.0.0.1:3000" },
    });
    const response = middleware(request);
    assert.notEqual(response.status, 401);
    assert.notEqual(response.status, 403);
  });

  it("allows GET /api/auth/setup without Authorization when STUDIO_API_TOKEN is set", () => {
    process.env.STUDIO_API_TOKEN = "host-setup-token";
    process.env.PUBLIC_APP_URL = "https://uwe.example";

    const request = new NextRequest("http://127.0.0.1:3000/api/auth/setup", {
      headers: { host: "127.0.0.1:3000" },
    });
    const response = middleware(request);
    assert.notEqual(response.status, 401);
    assert.notEqual(response.status, 403);
  });

  it("blocks protected studio API without bearer token when STUDIO_API_TOKEN is set", () => {
    process.env.STUDIO_API_TOKEN = "host-setup-token";
    process.env.PUBLIC_APP_URL = "https://uwe.example";

    const request = new NextRequest("http://127.0.0.1:3000/api/settings", {
      headers: { host: "127.0.0.1:3000" },
    });
    const response = middleware(request);
    assert.equal(response.status, 401);
  });

  it("rejects invalid bearer token on protected studio API routes", async () => {
    process.env.STUDIO_API_TOKEN = "host-setup-token";
    process.env.PUBLIC_APP_URL = "https://uwe.example";

    const request = new NextRequest("http://127.0.0.1:3000/api/settings", {
      headers: {
        host: "127.0.0.1:3000",
        authorization: "Bearer wrong-token",
      },
    });
    const response = middleware(request);
    assert.equal(response.status, 401);
    const body = (await response.json()) as { error?: string };
    assert.match(body.error ?? "", /Studio-API-Token|Ungültiges Studio-API-Token/);
  });

  it("allows protected studio API with valid bearer token", () => {
    process.env.STUDIO_API_TOKEN = "host-setup-token";
    process.env.PUBLIC_APP_URL = "https://uwe.example";
    process.env.AUTH_REQUIRED = "false";

    const request = new NextRequest("http://127.0.0.1:3000/api/settings", {
      headers: {
        host: "127.0.0.1:3000",
        authorization: "Bearer host-setup-token",
      },
    });
    const response = middleware(request);
    assert.notEqual(response.status, 401);
    assert.notEqual(response.status, 403);
  });

  it("blocks cross-site API requests", () => {
    const request = new NextRequest("http://studio.local/api/settings", {
      headers: { "sec-fetch-site": "cross-site", host: "studio.local" },
    });
    const response = middleware(request);
    assert.equal(response.status, 403);
  });

  it("allows same-origin API requests when auth is not required", () => {
    process.env.AUTH_REQUIRED = "false";
    const request = new NextRequest("http://studio.local/api/settings", {
      headers: { "sec-fetch-site": "same-origin", host: "studio.local" },
    });
    const response = middleware(request);
    assert.notEqual(response.status, 403);
  });

  it("allows health endpoint without cross-origin block", () => {
    const request = new NextRequest("http://studio.local/api/health", {
      headers: { "sec-fetch-site": "cross-site", host: "studio.local" },
    });
    const response = middleware(request);
    assert.notEqual(response.status, 403);
  });

  it("adds security headers to page responses", () => {
    process.env.AUTH_REQUIRED = "false";
    const request = new NextRequest("http://studio.local/", {
      headers: { host: "studio.local" },
    });
    const response = middleware(request);
    assert.equal(response.headers.get("X-Frame-Options"), "SAMEORIGIN");
    assert.ok(response.headers.get("Content-Security-Policy"));
  });
});
