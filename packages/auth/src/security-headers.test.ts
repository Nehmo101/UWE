import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  getUweSecurityHeaderEntries,
  getUweSecurityHeaders,
} from "./security-headers";

describe("security headers", () => {
  it("sets core browser protection headers", () => {
    const headers = getUweSecurityHeaders({ NODE_ENV: "development" });

    assert.match(headers["Content-Security-Policy"], /default-src 'self'/);
    assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
    assert.equal(headers["X-Frame-Options"], "DENY");
    assert.match(headers["Permissions-Policy"], /camera=\(\)/);
  });

  it("allows only explicit YouTube frame sources", () => {
    const csp = buildContentSecurityPolicy({ allowYouTubeEmbeds: true });
    assert.match(csp, /frame-src https:\/\/www\.youtube\.com https:\/\/www\.youtube-nocookie\.com/);
    assert.doesNotMatch(csp, /\*/);
  });

  it("documents inline script allowance required by Next.js hydration", () => {
    const csp = buildContentSecurityPolicy();
    assert.match(csp, /script-src 'self' 'unsafe-inline'/);
  });

  it("sends HSTS only in production behind HTTPS", () => {
    const devHeaders = getUweSecurityHeaders({ NODE_ENV: "development" });
    assert.equal(devHeaders["Strict-Transport-Security"], undefined);

    const prodHttp = getUweSecurityHeaders({
      NODE_ENV: "production",
      SESSION_COOKIE_SECURE: "false",
      PUBLIC_APP_URL: "",
    });
    assert.equal(prodHttp["Strict-Transport-Security"], undefined);

    const prodHttps = getUweSecurityHeaders({
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uweandragons.org",
      SESSION_COOKIE_SECURE: "true",
    });
    assert.equal(
      prodHttps["Strict-Transport-Security"],
      "max-age=31536000; includeSubDomains",
    );
  });

  it("exposes header entries for Next.js config", () => {
    const entries = getUweSecurityHeaderEntries({ NODE_ENV: "development" });
    assert.ok(entries.some((entry) => entry.key === "Content-Security-Policy"));
    assert.ok(entries.some((entry) => entry.key === "X-Content-Type-Options"));
  });

  it("applies headers to an existing response", () => {
    const response = new Response("ok");
    applySecurityHeaders(response, { NODE_ENV: "development" });

    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.ok(response.headers.get("Content-Security-Policy"));
  });
});
