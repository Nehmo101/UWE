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
  rebaseUrlOnPublicOrigin,
  resolveFamilyPublicBaseUrl,
  resolvePortalSessionHref,
  resolveStudioSessionHref,
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

  it("omits cookie Domain by default (host-only)", () => {
    const options = getSessionCookieOptions({ NODE_ENV: "production" });
    assert.equal(options.domain, undefined);
  });

  it("sets a domain-wide cookie when SESSION_COOKIE_DOMAIN is configured", () => {
    const options = getSessionCookieOptions({
      NODE_ENV: "production",
      SESSION_COOKIE_DOMAIN: ".uwe.example",
    });
    assert.equal(options.domain, ".uwe.example");
  });

  it("ignores a malformed SESSION_COOKIE_DOMAIN (scheme/path/port)", () => {
    for (const bad of ["https://uwe.example", "uwe.example/x", "host:3000", "  "]) {
      const options = getSessionCookieOptions({
        NODE_ENV: "production",
        SESSION_COOKIE_DOMAIN: bad,
      });
      assert.equal(options.domain, undefined, `expected no domain for ${JSON.stringify(bad)}`);
    }
  });

  it("keeps production cookies secure by default", () => {
    const options = getSessionCookieOptions({
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uwe.example",
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
    assert.equal(
      isPublicExposureConfigured({ PUBLIC_BASE_URL: "http://127.0.0.1:3000" }),
      false,
    );
    assert.equal(
      isPublicExposureConfigured({ PUBLIC_BASE_URL: "http://localhost:3000" }),
      false,
    );
    assert.equal(
      getUweRuntimeConfig({
        NODE_ENV: "production",
        PUBLIC_BASE_URL: "http://127.0.0.1:3000",
      }).trustProxy,
      false,
    );
  });

  it("matches trusted origins including PUBLIC_APP_URL host", () => {
    const env = { PUBLIC_APP_URL: "https://uwe.example" };
    const hosts = getTrustedRequestHosts("localhost:3001", env);

    assert.ok(hosts.has("localhost:3001"));
    assert.ok(hosts.has("uwe.example"));
    assert.ok(
      originMatchesTrustedHost("https://uwe.example", "localhost:3001", env),
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
      PUBLIC_APP_URL: "https://uwe.example",
      NEXT_PUBLIC_PORTAL_URL: "https://uwe.example",
      NEXT_PUBLIC_STUDIO_URL: "https://studio.uwe.example",
    });
    assert.equal(urls.deploymentModel, "split-hostname");
    assert.equal(urls.studioPath, "/");
    assert.equal(urls.portalPath, "/");
    assert.equal(urls.studioUrl, "https://studio.uwe.example");
    assert.equal(urls.portalUrl, "https://uwe.example");
  });

  it("builds portal session href for split-hostname deployments", () => {
    const href = resolvePortalSessionHref({
      PUBLIC_APP_URL: "https://uwe.example",
      NEXT_PUBLIC_PORTAL_URL: "https://uwe.example",
      NEXT_PUBLIC_STUDIO_URL: "https://studio.uwe.example",
    });
    assert.equal(href, "https://uwe.example/auth/worlds");
  });

  it("builds portal session href without duplicating mount path", () => {
    const href = resolvePortalSessionHref({
      PUBLIC_APP_URL: "https://uwe.example.org",
    });
    assert.equal(href, "https://uwe.example.org/portal");
  });

  it("builds studio session href on split-hostname studio surface", () => {
    const href = resolveStudioSessionHref(
      {
        PUBLIC_APP_URL: "https://uwe.example",
        NEXT_PUBLIC_PORTAL_URL: "https://uwe.example",
        NEXT_PUBLIC_STUDIO_URL: "https://studio.uwe.example",
      },
      { currentApp: "studio" },
    );
    assert.equal(href, "/worlds");
  });

  it("builds studio session href from portal on split-hostname", () => {
    const href = resolveStudioSessionHref(
      {
        PUBLIC_APP_URL: "https://uwe.example",
        NEXT_PUBLIC_PORTAL_URL: "https://uwe.example",
        NEXT_PUBLIC_STUDIO_URL: "https://studio.uwe.example",
      },
      { currentApp: "portal" },
    );
    assert.equal(href, "https://studio.uwe.example/worlds");
  });

  it("builds studio session href for unified-path deployments", () => {
    const href = resolveStudioSessionHref(
      {
        PUBLIC_APP_URL: "https://uwe.example.org",
      },
      { currentApp: "studio" },
    );
    assert.equal(href, "/studio");
  });
});

describe("family link target", () => {
  it("falls back to the loopback default and honours NEXT_PUBLIC_FAMILY_URL", () => {
    assert.equal(resolveFamilyPublicBaseUrl({}), "http://localhost:3004");
    assert.equal(
      resolveFamilyPublicBaseUrl({ NEXT_PUBLIC_FAMILY_URL: "https://family.uwe.example/" }),
      "https://family.uwe.example",
    );
  });

  it("derives family.<apex> from the sibling hostnames in a split-hostname deployment", () => {
    // Ohne Ableitung stünde hier der Loopback-Standard, den ein Besucher von
    // portal.uwe.example nie erreicht.
    assert.equal(
      resolveFamilyPublicBaseUrl({
        NEXT_PUBLIC_STUDIO_URL: "https://studio.uwe.example",
        NEXT_PUBLIC_PORTAL_URL: "https://portal.uwe.example",
      }),
      "https://family.uwe.example",
    );
  });

  it("lets an explicit family URL win over the derived one", () => {
    assert.equal(
      resolveFamilyPublicBaseUrl({
        NEXT_PUBLIC_STUDIO_URL: "https://studio.uwe.example",
        NEXT_PUBLIC_PORTAL_URL: "https://portal.uwe.example",
        NEXT_PUBLIC_FAMILY_URL: "https://haushalt.uwe.example",
      }),
      "https://haushalt.uwe.example",
    );
  });

  it("does not derive from port-based or single-host layouts", () => {
    // Ports auf einem Host: der Geschwister-Hostname sagt nichts über Family.
    assert.equal(
      resolveFamilyPublicBaseUrl({
        NEXT_PUBLIC_STUDIO_URL: "http://studio.fritz.box:3000",
        NEXT_PUBLIC_PORTAL_URL: "http://portal.fritz.box:3001",
      }),
      "http://localhost:3004",
    );
    // Pfad-Layout auf einem Origin ist kein Split-Hostname-Deployment.
    assert.equal(
      resolveFamilyPublicBaseUrl({
        NEXT_PUBLIC_STUDIO_URL: "https://uwe.example/studio",
        NEXT_PUBLIC_PORTAL_URL: "https://uwe.example/portal",
      }),
      "http://localhost:3004",
    );
  });

  it("rebases the loopback login redirect onto the public family origin", () => {
    // Family binds to 127.0.0.1, so `request.nextUrl` carries the loopback host
    // and port — a tunnel visitor would otherwise be sent to localhost:3004.
    const rebased = rebaseUrlOnPublicOrigin(
      new URL("http://localhost:3004/kitchen"),
      "https://family.uwe.example",
    );
    assert.equal(rebased.toString(), "https://family.uwe.example/kitchen");
  });

  it("keeps the request URL for loopback and malformed public origins", () => {
    assert.equal(
      rebaseUrlOnPublicOrigin(new URL("http://localhost:3004/login"), "http://localhost:3004").toString(),
      "http://localhost:3004/login",
    );
    assert.equal(
      rebaseUrlOnPublicOrigin(new URL("http://localhost:3004/login"), "nicht-mal-eine-url").toString(),
      "http://localhost:3004/login",
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
