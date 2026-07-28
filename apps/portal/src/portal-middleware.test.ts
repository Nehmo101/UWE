import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

function makeRequest(url: string) {
  return new NextRequest(url, { headers: { host: new URL(url).host } });
}

// Split-hostname deployment: Portal on the apex, Studio on a subdomain. This is
// what activates the legacy-path redirects (see resolveLegacyPathRedirect).
function enableSplitHostname() {
  process.env.PUBLIC_APP_URL = "https://uwe.example";
  process.env.NEXT_PUBLIC_PORTAL_URL = "https://uwe.example";
  process.env.NEXT_PUBLIC_STUDIO_URL = "https://studio.uwe.example";
}

describe("portal middleware legacy redirects", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // The maintenance gate probes an internal API via fetch. Stub it to a
    // non-blocking response so the middleware decision stays deterministic and
    // no real network request leaves the test runner.
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ blocked: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    const env = process.env as Record<string, string | undefined>;
    delete env.NODE_ENV;
    delete env.AUTH_REQUIRED;
    delete env.PUBLIC_APP_URL;
    delete env.NEXT_PUBLIC_STUDIO_URL;
    delete env.NEXT_PUBLIC_PORTAL_URL;
  });

  it("redirects old /studio links to the Studio subdomain", async () => {
    enableSplitHostname();

    const response = await middleware(
      makeRequest("https://uwe.example/studio/worlds/terra?tab=brain"),
    );

    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "https://studio.uwe.example/worlds/terra?tab=brain");
  });

  it("redirects old /portal links to canonical Portal routes", async () => {
    enableSplitHostname();

    const response = await middleware(makeRequest("https://uwe.example/portal/worlds/terra"));

    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "https://uwe.example/worlds/terra");
  });

  it("keeps Portal content login-required in production", async () => {
    const env = process.env as Record<string, string | undefined>;
    env.NODE_ENV = "production";
    env.AUTH_REQUIRED = "true";
    env.PUBLIC_APP_URL = "https://uwe.example";

    const response = await middleware(makeRequest("https://uwe.example/worlds/terra"));

    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://uwe.example/login?redirect=%2Fworlds%2Fterra");
  });
});
