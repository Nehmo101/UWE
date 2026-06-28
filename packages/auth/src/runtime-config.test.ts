import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getOAuthStateCookieOptions,
  getSessionCookieOptions,
  getSessionCookieOptionsForRequest,
  getTrustedRequestHosts,
  getUweRuntimeConfig,
  isPublicExposureConfigured,
  isRequestSecure,
  originMatchesTrustedHost,
  resolvePortalSessionHref,
  resolveUweAppUrls,
} from "./runtime-config";
import { resolveClientIp } from "./proxy";

describe("runtime config", () => {
  it("defaults Secure cookies only when PUBLIC_APP_URL is HTTPS", () => {
    const lanProduction = getUweRuntimeConfig({
      NODE_ENV: "production",
    });
    assert.equal(lanProduction.sessionCookieSecure, false);

    const httpsProduction = getUweRuntimeConfig({
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uwe.example.org",
    });
    assert.equal(httpsProduction.sessionCookieSecure, true);
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
      PUBLIC_APP_URL: "https://uweanddragons.org",
    });

    assert.equal(options.secure, true);
    assert.equal(options.httpOnly, true);
  });

  it("detects HTTPS from request URL and forwarded proto", () => {
    const env = { NODE_ENV: "production", TRUST_PROXY: "true" };

    assert.equal(
      isRequestSecure(
        {
          url: "http://192.168.178.40:3000/api/auth/login",
          headers: new Headers({ "x-forwarded-proto": "https" }),
        },
        env,
      ),
      true,
    );
    assert.equal(
      isRequestSecure(
        {
          url: "http://192.168.178.40:3000/api/auth/login",
          headers: new Headers({ "x-forwarded-proto": "http" }),
        },
        env,
      ),
      false,
    );
    assert.equal(
      isRequestSecure(
        {
          url: "https://studio.local/api/auth/login",
          headers: new Headers(),
        },
        env,
      ),
      true,
    );
  });

  it("drops Secure flag on plain HTTP so browsers store session cookies", () => {
    const env = {
      NODE_ENV: "production",
      SESSION_COOKIE_SECURE: "true",
      SESSION_COOKIE_SAMESITE: "lax",
    };

    const options = getSessionCookieOptionsForRequest(
      {
        url: "http://192.168.178.40:3000/api/auth/login",
        headers: new Headers(),
      },
      env,
    );

    assert.equal(options.secure, false);
    assert.equal(options.sameSite, "lax");
    assert.equal(options.httpOnly, true);
  });

  it("keeps Secure cookies on HTTPS requests", () => {
    const env = {
      NODE_ENV: "production",
      SESSION_COOKIE_SECURE: "true",
    };

    const options = getSessionCookieOptionsForRequest(
      {
        url: "https://uwe.example.org/api/auth/login",
        headers: new Headers(),
      },
      env,
    );

    assert.equal(options.secure, true);
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

  it("honours PORTAL_PATH=/ for unified reverse-proxy deployments", () => {
    const urls = resolveUweAppUrls({
      PUBLIC_APP_URL: "https://uwe.example.org",
      PORTAL_PATH: "/",
    });
    assert.equal(urls.portalPath, "/");
    assert.equal(urls.portalUrl, "https://uwe.example.org");
    assert.equal(urls.deploymentModel, "unified-path");
  });

  it("uses split-hostname URLs with root paths when hosts differ", () => {
    const urls = resolveUweAppUrls({
      PUBLIC_APP_URL: "https://uweanddragons.org",
      NEXT_PUBLIC_PORTAL_URL: "https://uweanddragons.org",
      NEXT_PUBLIC_STUDIO_URL: "https://studio.uweanddragons.org",
    });
    assert.equal(urls.deploymentModel, "split-hostname");
    assert.equal(urls.studioPath, "/");
    assert.equal(urls.portalPath, "/");
    assert.equal(urls.studioUrl, "https://studio.uweanddragons.org");
    assert.equal(urls.portalUrl, "https://uweanddragons.org");
  });

  it("builds portal session href for split-hostname deployments", () => {
    const href = resolvePortalSessionHref({
      PUBLIC_APP_URL: "https://uweanddragons.org",
      NEXT_PUBLIC_PORTAL_URL: "https://uweanddragons.org",
      NEXT_PUBLIC_STUDIO_URL: "https://studio.uweanddragons.org",
    });
    assert.equal(href, "https://uweanddragons.org/auth/worlds");
  });

  it("builds portal session href without duplicating mount path", () => {
    const href = resolvePortalSessionHref({
      PUBLIC_APP_URL: "https://uwe.example.org",
    });
    assert.equal(href, "https://uwe.example.org/portal");
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
