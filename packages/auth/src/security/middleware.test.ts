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

  it("allows /setup without Authorization when STUDIO_API_TOKEN is configured", () => {
    const decision = evaluateStudioMiddleware(
      makeRequest("/setup", { headers: { host: "127.0.0.1:3000" } }),
      {
        ...process.env,
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uweanddragons.org",
        CLOUDFLARE_TUNNEL: "true",
        STUDIO_API_TOKEN: "secret",
      },
    );
    assert.equal(decision.action, "allow");
  });

  it("allows GET /api/auth/setup without Authorization when STUDIO_API_TOKEN is configured", () => {
    const decision = evaluateStudioMiddleware(
      makeRequest("/api/auth/setup", { headers: { host: "127.0.0.1:3000" } }),
      {
        ...process.env,
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uweanddragons.org",
        CLOUDFLARE_TUNNEL: "true",
        STUDIO_API_TOKEN: "secret",
      },
    );
    assert.equal(decision.action, "allow");
  });

  it("blocks protected studio API without bearer token when STUDIO_API_TOKEN is configured", () => {
    const decision = evaluateStudioMiddleware(
      makeRequest("/api/brain/run", { headers: { host: "127.0.0.1:3000" } }),
      {
        ...process.env,
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uweanddragons.org",
        CLOUDFLARE_TUNNEL: "true",
        STUDIO_API_TOKEN: "secret",
      },
    );
    assert.equal(decision.action, "block");
    assert.equal(decision.status, 401);
    assert.match(decision.error ?? "", /Studio-API-Token erforderlich/);
  });

  it("rejects invalid bearer token on protected studio API routes", () => {
    const decision = evaluateStudioMiddleware(
      makeRequest("/api/brain/run", {
        headers: {
          host: "127.0.0.1:3000",
          authorization: "Bearer wrong-token",
        },
      }),
      {
        ...process.env,
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uweanddragons.org",
        CLOUDFLARE_TUNNEL: "true",
        STUDIO_API_TOKEN: "secret",
      },
    );
    assert.equal(decision.action, "block");
    assert.equal(decision.status, 401);
  });

  it("allows protected studio API with valid bearer token", () => {
    const decision = evaluateStudioMiddleware(
      makeRequest("/api/brain/run", {
        headers: {
          host: "127.0.0.1:3000",
          authorization: "Bearer secret",
        },
      }),
      {
        ...process.env,
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uweanddragons.org",
        CLOUDFLARE_TUNNEL: "true",
        STUDIO_API_TOKEN: "secret",
      },
    );
    assert.equal(decision.action, "allow");
  });
});
