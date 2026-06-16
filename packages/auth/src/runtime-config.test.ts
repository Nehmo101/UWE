import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getOAuthStateCookieOptions,
  getSessionCookieOptions,
  getTrustedRequestHosts,
  getUweRuntimeConfig,
  isPublicExposureConfigured,
  originMatchesTrustedHost,
} from "./runtime-config";
import { resolveClientIp } from "./proxy";

describe("runtime config", () => {
  it("defaults to secure production settings behind PUBLIC_APP_URL", () => {
    const config = getUweRuntimeConfig({
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uweanddragons.org/",
    });

    assert.equal(config.isProduction, true);
    assert.equal(config.publicAppUrl, "https://uweanddragons.org");
    assert.equal(config.trustProxy, true);
    assert.equal(config.authRequired, true);
    assert.equal(config.sessionCookieSecure, true);
    assert.equal(config.playerPreviewPublic, false);
    assert.equal(config.playerPreviewRequireToken, true);
    assert.equal(config.playerPreviewAllowDmOnly, false);
  });

  it("honours explicit overrides", () => {
    const config = getUweRuntimeConfig({
      NODE_ENV: "production",
      TRUST_PROXY: "false",
      AUTH_REQUIRED: "false",
      PLAYER_PREVIEW_PUBLIC: "true",
      SESSION_COOKIE_SECURE: "false",
      SESSION_COOKIE_SAMESITE: "strict",
    });

    assert.equal(config.trustProxy, false);
    assert.equal(config.authRequired, false);
    assert.equal(config.playerPreviewPublic, true);
    assert.equal(config.sessionCookieSecure, false);
    assert.equal(config.sessionCookieSameSite, "strict");
  });

  it("builds session cookie options from config", () => {
    const options = getSessionCookieOptions({
      NODE_ENV: "production",
      SESSION_COOKIE_SAMESITE: "lax",
      SESSION_COOKIE_SECURE: "true",
    });

    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, "lax");
    assert.equal(options.path, "/");
  });

  it("keeps production cookies secure by default", () => {
    const options = getSessionCookieOptions({
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uweandragons.org",
    });

    assert.equal(options.secure, true);
    assert.equal(options.httpOnly, true);
  });

  it("scopes OAuth state cookies to callback path", () => {
    const options = getOAuthStateCookieOptions("/api/spotify/callback", {
      NODE_ENV: "production",
      SESSION_COOKIE_SECURE: "true",
    });

    assert.equal(options.path, "/api/spotify/callback");
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
  });

  it("parses optional allowed CORS origins from env", () => {
    const config = getUweRuntimeConfig({
      ALLOWED_CORS_ORIGINS: "https://partner.example, https://second.example/",
    });

    assert.deepEqual(config.allowedCorsOrigins, [
      "https://partner.example",
      "https://second.example",
    ]);
  });

  it("detects public exposure configuration", () => {
    assert.equal(isPublicExposureConfigured({}), false);
    assert.equal(
      isPublicExposureConfigured({ CLOUDFLARE_TUNNEL: "true" }),
      true,
    );
    assert.equal(
      isPublicExposureConfigured({ PUBLIC_APP_URL: "https://example.com" }),
      true,
    );
  });

  it("matches trusted origins including PUBLIC_APP_URL host", () => {
    const env = { PUBLIC_APP_URL: "https://uweanddragons.org" };
    const hosts = getTrustedRequestHosts("localhost:3001", env);

    assert.ok(hosts.has("localhost:3001"));
    assert.ok(hosts.has("uweanddragons.org"));
    assert.ok(
      originMatchesTrustedHost("https://uweanddragons.org", "localhost:3001", env),
    );
    assert.equal(
      originMatchesTrustedHost("https://evil.example", "localhost:3001", env),
      false,
    );
  });
});

describe("resolveClientIp", () => {
  it("ignores forwarded headers when TRUST_PROXY is false", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
    assert.equal(resolveClientIp(headers, { TRUST_PROXY: "false" }), "unknown");
  });

  it("uses forwarded headers when TRUST_PROXY is true", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    assert.equal(resolveClientIp(headers, { TRUST_PROXY: "true" }), "203.0.113.7");
  });
});
