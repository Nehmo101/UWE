import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyRoute, isPublicRoute, isUnknownProtectedApi } from "./route-policy";
import { evaluateBrainMiddleware } from "./middleware";

function makeRequest(pathname: string, options: { session?: string } = {}) {
  return {
    pathname,
    url: `https://brain.uwe.example${pathname}`,
    headers: new Headers({ host: "brain.uwe.example" }),
    cookies: {
      get(name: string) {
        return name === "uwe_session" && options.session ? { value: options.session } : undefined;
      },
    },
  };
}

const prodBrainEnv = { ...process.env, NODE_ENV: "production", AUTH_REQUIRED: "true" };
const devBrainEnv = { ...process.env, NODE_ENV: "development" };

describe("brain route policy (owner-only, deny-by-default)", () => {
  it("keeps only /login and health public", () => {
    assert.equal(isPublicRoute("/login", "brain"), true);
    assert.equal(isPublicRoute("/api/health", "brain"), true);
    assert.equal(isPublicRoute("/api/health/public", "brain"), true);
    assert.equal(isPublicRoute("/", "brain"), false);
    assert.equal(isPublicRoute("/life-brain", "brain"), false);
  });

  it("treats brain pages as session-protected", () => {
    for (const path of ["/", "/life-brain", "/today", "/mail"]) {
      assert.equal(classifyRoute(path, "brain").access, "protected-session", path);
    }
  });

  it("denies unknown brain APIs by default", () => {
    assert.equal(isUnknownProtectedApi("/api/life-brain/list", "brain"), true);
    assert.equal(isUnknownProtectedApi("/api/anything", "brain"), true);
    assert.equal(isUnknownProtectedApi("/api/health", "brain"), false);
  });
});

describe("evaluateBrainMiddleware", () => {
  it("allows everything in development", () => {
    assert.equal(evaluateBrainMiddleware(makeRequest("/life-brain"), devBrainEnv).action, "allow");
  });

  it("redirects brain pages to /login without a session", () => {
    for (const path of ["/", "/life-brain", "/today"]) {
      const d = evaluateBrainMiddleware(makeRequest(path), prodBrainEnv);
      assert.equal(d.action, "redirect-login", path);
      assert.equal(d.redirectPath, "/login", path);
    }
  });

  it("allows brain pages with a session (owner role enforced server-side)", () => {
    const d = evaluateBrainMiddleware(makeRequest("/life-brain", { session: "s" }), prodBrainEnv);
    assert.equal(d.action, "allow");
  });

  it("hides unknown brain APIs (404) and blocks known ones (401) without a session", () => {
    const unknown = evaluateBrainMiddleware(makeRequest("/api/life-brain/list"), prodBrainEnv);
    assert.equal(unknown.action, "block");
    assert.equal(unknown.status, 404);

    const health = evaluateBrainMiddleware(makeRequest("/api/health"), prodBrainEnv);
    assert.equal(health.action, "allow");
  });

  it("keeps /login reachable without a session", () => {
    assert.equal(evaluateBrainMiddleware(makeRequest("/login"), prodBrainEnv).action, "allow");
  });
});
