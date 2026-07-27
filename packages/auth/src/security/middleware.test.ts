import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePortalMiddleware, evaluateStudioMiddleware } from "./middleware";

function makeRequest(pathname: string, options: { session?: string; headers?: Record<string, string> } = {}) {
  const headers = new Headers(options.headers ?? { host: "uwe.example" });
  return {
    pathname,
    url: `https://uwe.example${pathname}`,
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

const productionPortalEnv = {
  ...process.env,
  NODE_ENV: "production",
  AUTH_REQUIRED: "true",
  PUBLIC_APP_URL: "https://uwe.example",
};

describe("middleware evaluation", () => {
  it("allows anonymous share routes without a session", () => {
    for (const path of ["/share/abc123", "/api/share/abc123", "/api/share/abc123/verify"]) {
      const decision = evaluatePortalMiddleware(makeRequest(path), productionPortalEnv);
      assert.equal(decision.action, "allow", path);
    }
  });

  it("redirects portal app content to login without a session", () => {
    for (const path of ["/", "/portal", "/worlds", "/worlds/terra", "/players", "/players/terra"]) {
      const decision = evaluatePortalMiddleware(makeRequest(path), productionPortalEnv);
      assert.equal(decision.action, "redirect-login", path);
      assert.equal(decision.redirectPath, "/login", path);
    }
  });

  it("allows portal app content with a session", () => {
    for (const path of ["/", "/portal", "/worlds", "/worlds/terra", "/players/terra"]) {
      const decision = evaluatePortalMiddleware(makeRequest(path, { session: "session-token" }), productionPortalEnv);
      assert.equal(decision.action, "allow", path);
    }
  });

  it("blocks session-protected portal APIs without a session", () => {
    for (const path of [
      "/api/worlds/terra/graph",
      "/api/assets/asset-123/file",
    ]) {
      const decision = evaluatePortalMiddleware(makeRequest(path), productionPortalEnv);
      assert.equal(decision.action, "block", path);
      assert.equal(decision.status, 401, path);
    }
  });

  it("allows session-protected portal APIs with a session", () => {
    for (const path of [
      "/api/worlds/terra/graph",
      "/api/worlds/terra/characters/print",
      "/api/assets/asset-123/file",
    ]) {
      const decision = evaluatePortalMiddleware(makeRequest(path, { session: "session-token" }), productionPortalEnv);
      assert.equal(decision.action, "allow", path);
    }
  });

  it("blocks protected studio API without auth when publicly exposed", () => {
    const decision = evaluateStudioMiddleware(makeRequest("/api/brain/run"), {
      ...process.env,
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uwe.example",
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
      PUBLIC_APP_URL: "https://uwe.example",
      CLOUDFLARE_TUNNEL: "true",
    });
    assert.equal(decision.action, "block");
    assert.equal(decision.status, 404);
  });

  it("allows studio health endpoint", () => {
    const decision = evaluateStudioMiddleware(makeRequest("/api/health"), {
      ...process.env,
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uwe.example",
      CLOUDFLARE_TUNNEL: "true",
      STUDIO_API_TOKEN: "secret",
    });
    assert.equal(decision.action, "allow");
  });

  it("allows public health probes on portal and studio", () => {
    for (const pathname of ["/api/health/public"]) {
      const portalDecision = evaluatePortalMiddleware(makeRequest(pathname), {
        ...process.env,
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uwe.example",
      });
      assert.equal(portalDecision.action, "allow", `portal ${pathname}`);

      const studioDecision = evaluateStudioMiddleware(makeRequest(pathname), {
        ...process.env,
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uwe.example",
        CLOUDFLARE_TUNNEL: "true",
        STUDIO_API_TOKEN: "secret",
      });
      assert.equal(studioDecision.action, "allow", `studio ${pathname}`);
    }
  });

  it("allows /setup without Authorization when STUDIO_API_TOKEN is configured", () => {
    const decision = evaluateStudioMiddleware(
      makeRequest("/setup", { headers: { host: "127.0.0.1:3000" } }),
      {
        ...process.env,
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uwe.example",
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
        PUBLIC_APP_URL: "https://uwe.example",
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
        PUBLIC_APP_URL: "https://uwe.example",
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
        PUBLIC_APP_URL: "https://uwe.example",
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
        PUBLIC_APP_URL: "https://uwe.example",
        CLOUDFLARE_TUNNEL: "true",
        STUDIO_API_TOKEN: "secret",
      },
    );
    assert.equal(decision.action, "allow");
  });

  it("allows studio app navigation without bearer when STUDIO_API_TOKEN is configured", () => {
    const decision = evaluateStudioMiddleware(
      makeRequest("/", { headers: { host: "studio.uwe.example" } }),
      {
        ...process.env,
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uwe.example",
        NEXT_PUBLIC_STUDIO_URL: "https://studio.uwe.example",
        CLOUDFLARE_TUNNEL: "true",
        STUDIO_API_TOKEN: "secret",
      },
    );
    assert.equal(decision.action, "allow");
  });
});