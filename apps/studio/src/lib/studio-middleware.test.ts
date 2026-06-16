import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

describe("studio middleware deny-by-default", () => {
  afterEach(() => {
    delete process.env.STUDIO_API_TOKEN;
    delete process.env.AUTH_REQUIRED;
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
    assert.equal(response.headers.get("X-Frame-Options"), "DENY");
    assert.ok(response.headers.get("Content-Security-Policy"));
  });
});
