import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyRoute, isPublicRoute, isUnknownProtectedApi } from "./route-policy";
import { evaluateBrainMiddleware, evaluateFamilyMiddleware } from "./middleware";

function makeRequest(pathname: string, options: { session?: string; bearer?: string } = {}) {
  const headers = new Headers({ host: "family.uwe.example" });
  if (options.bearer) {
    headers.set("authorization", `Bearer ${options.bearer}`);
  }
  return {
    pathname,
    url: `https://family.uwe.example${pathname}`,
    headers,
    cookies: {
      get(name: string) {
        return name === "uwe_session" && options.session ? { value: options.session } : undefined;
      },
    },
  };
}

const prodFamilyEnv = { ...process.env, NODE_ENV: "production", AUTH_REQUIRED: "true" };
const devFamilyEnv = { ...process.env, NODE_ENV: "development" };

describe("family route policy (checkbox-gated, deny-by-default)", () => {
  it("keeps login, health, calendar feed and CalDAV public", () => {
    assert.equal(isPublicRoute("/login", "family"), true);
    assert.equal(isPublicRoute("/api/health", "family"), true);
    assert.equal(isPublicRoute("/api/calendar/feed/uwecal_abc123.ics", "family"), true);
    assert.equal(isPublicRoute("/api/dav", "family"), true);
    assert.equal(isPublicRoute("/api/dav/cal/familie/", "family"), true);
    assert.equal(isPublicRoute("/.well-known/caldav", "family"), true);
    assert.equal(isPublicRoute("/", "family"), false);
    assert.equal(isPublicRoute("/calendar", "family"), false);
    assert.equal(isPublicRoute("/api/calendar/events", "family"), false);
  });

  it("keeps the family-only public routes protected on the brain surface", () => {
    // Regression guard: the family/brain branch split must not widen Brain.
    assert.equal(isPublicRoute("/api/calendar/feed/uwecal_abc123.ics", "brain"), false);
    assert.equal(isPublicRoute("/api/dav/cal/familie/", "brain"), false);
    assert.equal(isPublicRoute("/.well-known/caldav", "brain"), false);
  });

  it("treats family pages as session-protected", () => {
    for (const path of ["/", "/calendar", "/kitchen", "/members"]) {
      assert.equal(classifyRoute(path, "family").access, "protected-session", path);
    }
  });

  it("denies unknown family APIs by default", () => {
    assert.equal(isUnknownProtectedApi("/api/anything", "family"), true);
    assert.equal(isUnknownProtectedApi("/api/calendar/feed/uwecal_x", "family"), false);
    assert.equal(isUnknownProtectedApi("/api/dav/cal/familie/x.ics", "family"), false);
  });

  it("treats the token API v1 as known-protected on family, unknown on brain", () => {
    // Family: dokumentierte Bearer-Fläche → 401 statt 404 ohne Auth.
    assert.equal(isUnknownProtectedApi("/api/v1/day-brief", "family"), false);
    assert.equal(classifyRoute("/api/v1/day-brief", "family").access, "protected");
    // Brain kennt keine v1-Token-API — bleibt deny-by-default versteckt.
    assert.equal(isUnknownProtectedApi("/api/v1/day-brief", "brain"), true);
  });
});

describe("evaluateFamilyMiddleware", () => {
  it("allows everything in development", () => {
    assert.equal(evaluateFamilyMiddleware(makeRequest("/calendar"), devFamilyEnv).action, "allow");
  });

  it("lets the ICS feed and CalDAV through without a session in production", () => {
    for (const path of [
      "/api/calendar/feed/uwecal_abc123.ics",
      "/api/dav",
      "/api/dav/cal/familie/uwe-family-event-1.ics",
      "/.well-known/caldav",
    ]) {
      assert.equal(evaluateFamilyMiddleware(makeRequest(path), prodFamilyEnv).action, "allow", path);
    }
  });

  it("redirects family pages to /login without a session", () => {
    const d = evaluateFamilyMiddleware(makeRequest("/calendar"), prodFamilyEnv);
    assert.equal(d.action, "redirect-login");
    assert.equal(d.redirectPath, "/login");
  });

  it("hides unknown family APIs (404) and blocks known ones (401) without a session", () => {
    const unknown = evaluateFamilyMiddleware(makeRequest("/api/anything"), prodFamilyEnv);
    assert.equal(unknown.action, "block");
    assert.equal(unknown.status, 404);

    const known = evaluateFamilyMiddleware(makeRequest("/api/calendar/events"), prodFamilyEnv);
    assert.equal(known.action, "block");
    assert.equal(known.status, 401);
  });

  it("lets Bearer requests through to the v1 handlers in production", () => {
    const withToken = evaluateFamilyMiddleware(
      makeRequest("/api/v1/day-brief", { bearer: "uwe_test123" }),
      prodFamilyEnv,
    );
    assert.equal(withToken.action, "allow");
  });

  it("blocks v1 without token or session with 401, not 404", () => {
    const bare = evaluateFamilyMiddleware(makeRequest("/api/v1/day-brief"), prodFamilyEnv);
    assert.equal(bare.action, "block");
    assert.equal(bare.status, 401);
  });

  it("does not open v1 with a Bearer header outside the family surface", () => {
    // Brain nutzt dieselbe Checkbox-Middleware — dort bleibt v1 unbekannt (404).
    const brain = evaluateBrainMiddleware(
      makeRequest("/api/v1/day-brief", { bearer: "uwe_test123" }),
      prodFamilyEnv,
    );
    assert.equal(brain.action, "block");
    assert.equal(brain.status, 404);
  });
});
