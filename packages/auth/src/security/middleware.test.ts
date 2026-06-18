import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePortalMiddleware, evaluateStudioMiddleware } from "./middleware";

function makeRequest(pathname: string, options: { session?: string; headers?: Record<string, string> } = {}) {
  const headers = new Headers(options.headers ?? { host: "uweanddragons.org" });
  return {
    pathname,
    url: `https://uweanddragons.org${pathname}`,
    headers,
    cookies: {
      get(name: string) {
        if (name === "uwe_session" && options.session) {
          return { value: options.session };
        }
        return undefined;
      },
    },
  };
}

describe("middleware evaluation", () => {
  it("allows public portal routes in production", () => {
    const decision = evaluatePortalMiddleware(makeRequest("/worlds/terra"), {
      ...process.env,
      NODE_ENV: "production",
      AUTH_REQUIRED: "false",
      PLAYER_PREVIEW_PUBLIC: "true",
      PUBLIC_APP_URL: "https://uweanddragons.org",
    });
    assert.equal(decision.action, "allow");
  });

  it("redirects guest wiki to login when auth is required", () => {
    const decision = evaluatePortalMiddleware(makeRequest("/worlds/terra"), {
      ...process.env,
      NODE_ENV: "production",
      AUTH_REQUIRED: "true",
      PUBLIC_APP_URL: "https://uweanddragons.org",
    });
    assert.equal(decision.action, "redirect-login");
    assert.equal(decision.redirectPath, "/login");
  });

  it("redirects /worlds and /players index to login when auth is required", () => {
    for (const path of ["/worlds", "/players"]) {
      const decision = evaluatePortalMiddleware(makeRequest(path), {
        ...process.env,
        NODE_ENV: "production",
        AUTH_REQUIRED: "true",
        PUBLIC_APP_URL: "https://uweanddragons.org",
      });
      assert.equal(decision.action, "redirect-login", path);
      assert.equal(decision.redirectPath, "/login");
    }
  });

  it("blocks protected studio API without auth when publicly exposed", () => {
    const decision = evaluateStudioMiddleware(makeRequest("/api/brain/run"), {
      ...process.env,
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uweanddragons.org",
      CLOUDFLARE_TUNNEL: "true",
      STUDIO_API_TOKEN: "secret",
    });
    assert.equal(decision.action, "block");
    assert.equal(decision.status, 401);
  });

  it("blocks unknown studio API routes", () => {
    const decision = evaluateStudioMiddleware(makeRequest("/api/unknown"), {
      ...process.env,
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uweanddragons.org",
      CLOUDFLARE_TUNNEL: "true",
    });
    assert.equal(decision.action, "block");
    assert.equal(decision.status, 404);
  });

  it("allows studio health endpoint", () => {
    const decision = evaluateStudioMiddleware(makeRequest("/api/health"), {
      ...process.env,
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uweanddragons.org",
      CLOUDFLARE_TUNNEL: "true",
      STUDIO_API_TOKEN: "secret",
    });
    assert.equal(decision.action, "allow");
  });
});
