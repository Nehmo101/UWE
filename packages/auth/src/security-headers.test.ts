import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  getUweSecurityHeaderEntries,
  getUweSecurityHeaders,
  shouldSendStrictTransportSecurityForRequest,
  wantsStrictTransportSecurity,
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
    const prodCsp = buildContentSecurityPolicy({}, { NODE_ENV: "production" });
    assert.match(prodCsp, /script-src 'self' 'unsafe-inline'/);
    assert.doesNotMatch(prodCsp, /unsafe-eval/);

    const devCsp = buildContentSecurityPolicy({}, { NODE_ENV: "development" });
    assert.match(devCsp, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
  });

  it("keeps a tight default CSP when Turnstile is not configured", () => {
    const csp = buildContentSecurityPolicy({}, { NODE_ENV: "production" });
    assert.doesNotMatch(csp, /challenges\.cloudflare\.com/);
    assert.match(csp, /connect-src 'self'(;|$)/);
    assert.match(csp, /frame-src 'none'/);
  });

  it("allows Cloudflare Turnstile origins only when the human-check is enabled", () => {
    const env = {
      NODE_ENV: "production",
      TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    };
    const csp = buildContentSecurityPolicy({ allowYouTubeEmbeds: true }, env);

    assert.match(csp, /script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
    assert.match(csp, /connect-src [^;]*https:\/\/challenges\.cloudflare\.com/);
    assert.match(csp, /frame-src [^;]*https:\/\/challenges\.cloudflare\.com/);
    // YouTube frame sources remain intact alongside Turnstile.
    assert.match(csp, /frame-src https:\/\/www\.youtube\.com/);
    assert.doesNotMatch(csp, /\*/);
  });

  it("disables Turnstile CSP origins via the kill-switch", () => {
    const csp = buildContentSecurityPolicy(
      {},
      {
        NODE_ENV: "production",
        TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
        TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
        TURNSTILE_ENABLED: "false",
      },
    );
    assert.doesNotMatch(csp, /challenges\.cloudflare\.com/);
  });

  it("does not send HSTS from static header builders (Next.js config)", () => {
    const devHeaders = getUweSecurityHeaders({ NODE_ENV: "development" });
    assert.equal(devHeaders["Strict-Transport-Security"], undefined);

    const prodHttps = getUweSecurityHeaders({
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uweandragons.org",
      SESSION_COOKIE_SECURE: "true",
    });
    assert.equal(prodHttps["Strict-Transport-Security"], undefined);
  });

  it("wants HSTS only in production behind HTTPS configuration", () => {
    assert.equal(wantsStrictTransportSecurity({ NODE_ENV: "development" }), false);
    assert.equal(
      wantsStrictTransportSecurity({
        NODE_ENV: "production",
        SESSION_COOKIE_SECURE: "false",
        PUBLIC_APP_URL: "",
      }),
      false,
    );
    assert.equal(
      wantsStrictTransportSecurity({
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uweandragons.org",
        SESSION_COOKIE_SECURE: "true",
      }),
      true,
    );
  });

  it("sends HSTS only on secure requests (Cloudflare / HTTPS)", () => {
    const env = {
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uweandragons.org",
      SESSION_COOKIE_SECURE: "true",
      TRUST_PROXY: "true",
    };

    const lanHttpRequest = {
      url: "http://192.168.178.40:3000/login",
      headers: new Headers(),
    };
    assert.equal(shouldSendStrictTransportSecurityForRequest(lanHttpRequest, env), false);
    assert.equal(
      getUweSecurityHeaders(env, { allowYouTubeEmbeds: true }, lanHttpRequest)[
        "Strict-Transport-Security"
      ],
      undefined,
    );

    const proxiedHttpsRequest = {
      url: "http://127.0.0.1:3000/login",
      headers: new Headers({ "x-forwarded-proto": "https" }),
    };
    assert.equal(shouldSendStrictTransportSecurityForRequest(proxiedHttpsRequest, env), true);
    assert.equal(
      getUweSecurityHeaders(env, { allowYouTubeEmbeds: true }, proxiedHttpsRequest)[
        "Strict-Transport-Security"
      ],
      "max-age=31536000; includeSubDomains",
    );
  });

  it("exposes header entries for Next.js config", () => {
    const entries = getUweSecurityHeaderEntries({ NODE_ENV: "development" });
    assert.ok(entries.some((entry) => entry.key === "Content-Security-Policy"));
    assert.ok(entries.some((entry) => entry.key === "X-Content-Type-Options"));
    assert.equal(
      entries.some((entry) => entry.key === "Strict-Transport-Security"),
      false,
    );
  });

  it("applies headers to an existing response", () => {
    const response = new Response("ok");
    applySecurityHeaders(response, { NODE_ENV: "development" });

    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.ok(response.headers.get("Content-Security-Policy"));
    assert.equal(response.headers.get("Strict-Transport-Security"), null);
  });
});
