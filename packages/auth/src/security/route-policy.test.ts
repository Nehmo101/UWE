import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyRoute,
  isGuestWikiPath,
  isPublicRoute,
  isUnknownProtectedApi,
  matchesRoutePattern,
  requiresPortalSession,
  requiresStudioAuth,
} from "./route-policy";

describe("route policy", () => {
  it("keeps portal auth entrypoints and anonymous share links public", () => {
    assert.equal(isPublicRoute("/login", "portal"), true);
    assert.equal(isPublicRoute("/forgot-password", "portal"), true);
    assert.equal(isPublicRoute("/reset-password", "portal"), true);
    assert.equal(isPublicRoute("/share/abc123", "portal"), true);
    assert.equal(isPublicRoute("/", "portal"), false);
    assert.equal(isPublicRoute("/worlds", "portal"), false);
    assert.equal(isPublicRoute("/worlds/terra", "portal"), false);
    assert.equal(isPublicRoute("/players/terra", "portal"), false);
  });

  it("treats portal app content routes as session-protected", () => {
    for (const path of ["/", "/portal", "/worlds", "/worlds/terra", "/players/terra"]) {
      assert.equal(classifyRoute(path, "portal").access, "protected-session", path);
    }
    assert.equal(classifyRoute("/share/abc123", "portal").access, "public");
  });

  it("treats portal auth routes as session-protected", () => {
    const authWorlds = classifyRoute("/auth/worlds/terra", "portal");
    assert.equal(authWorlds.access, "protected-session");
    assert.equal(classifyRoute("/api/auth/preview", "portal").access, "protected-session");
    assert.equal(classifyRoute("/api/auth/two-factor", "portal").access, "protected-session");
    assert.equal(classifyRoute("/api/auth/two-factor/setup", "portal").access, "protected-session");
    assert.equal(classifyRoute("/api/worlds", "portal").access, "protected-session");
  });

  it("treats graph, print and asset portal APIs as session-protected", () => {
    for (const path of [
      "/api/worlds/terra/graph",
      "/api/worlds/terra/characters/print",
      "/api/assets/asset-123/file",
    ]) {
      assert.equal(classifyRoute(path, "portal").access, "protected-session", path);
      assert.equal(isUnknownProtectedApi(path, "portal"), false, path);
    }
  });

  it("treats share portal APIs as public (token/password gated in handlers)", () => {
    for (const path of ["/api/share/abc123", "/api/share/abc123/verify"]) {
      assert.equal(classifyRoute(path, "portal").access, "public", path);
      assert.equal(isUnknownProtectedApi(path, "portal"), false, path);
    }
  });

  it("treats studio session auth routes as protected-session", () => {
    assert.equal(classifyRoute("/api/auth/two-factor", "studio").access, "protected-session");
    assert.equal(classifyRoute("/api/auth/two-factor/setup", "studio").access, "protected-session");
    assert.equal(classifyRoute("/api/auth/change-password", "studio").access, "protected-session");
    assert.equal(classifyRoute("/api/worlds", "studio").access, "protected-session");
    assert.equal(isUnknownProtectedApi("/api/auth/two-factor", "studio"), false);
  });

  it("keeps passkey login endpoints public on both surfaces", () => {
    for (const surface of ["studio", "portal"] as const) {
      assert.equal(classifyRoute("/api/auth/passkey/login/options", surface).access, "public");
      assert.equal(classifyRoute("/api/auth/passkey/login/verify", surface).access, "public");
    }
  });

  it("treats passkey management endpoints as session-protected on both surfaces", () => {
    for (const surface of ["studio", "portal"] as const) {
      for (const path of [
        "/api/auth/passkey/register/options",
        "/api/auth/passkey/register/verify",
        "/api/auth/passkey/credentials",
        "/api/auth/passkey/credentials/abc123",
      ]) {
        assert.equal(classifyRoute(path, surface).access, "protected-session", `${surface} ${path}`);
      }
    }
  });

  it("keeps unknown passkey subroutes protected", () => {
    assert.notEqual(classifyRoute("/api/auth/passkey/unknown", "studio").access, "public");
    assert.notEqual(classifyRoute("/api/auth/passkey/unknown", "portal").access, "public");
  });

  it("keeps google start/callback public and unlink session-protected", () => {
    assert.equal(classifyRoute("/api/auth/google/start", "studio").access, "public");
    assert.equal(classifyRoute("/api/auth/google/callback", "studio").access, "public");
    assert.equal(classifyRoute("/api/auth/google/unlink", "studio").access, "protected-session");
    assert.equal(classifyRoute("/api/auth/google/unlink", "portal").access, "protected-session");
    assert.notEqual(classifyRoute("/api/auth/google/other", "studio").access, "public");
  });

  it("treats studio auth pages as public", () => {
    assert.equal(isPublicRoute("/setup", "studio"), true);
    assert.equal(isPublicRoute("/login", "studio"), true);
    assert.equal(isPublicRoute("/forgot-password", "studio"), true);
    assert.equal(isPublicRoute("/reset-password", "studio"), true);
    assert.equal(isPublicRoute("/logout", "studio"), true);
    assert.equal(requiresStudioAuth("/setup"), false);
  });

  it("treats studio admin and brain APIs as protected", () => {
    assert.equal(requiresStudioAuth("/admin/status"), true);
    assert.equal(requiresStudioAuth("/api/brain/run"), true);
    assert.equal(requiresStudioAuth("/api/import/execute"), true);
    assert.equal(requiresStudioAuth("/api/ai/generate"), true);
    assert.equal(requiresStudioAuth("/api/command/search"), true);
    assert.equal(requiresStudioAuth("/api/health"), false);
  });

  it("denies unknown API routes by default", () => {
    assert.equal(isUnknownProtectedApi("/api/secret-endpoint", "portal"), true);
    assert.equal(isUnknownProtectedApi("/api/secret-endpoint", "studio"), true);
    assert.equal(isUnknownProtectedApi("/api/health", "portal"), false);
    assert.equal(isUnknownProtectedApi("/api/health", "studio"), false);
    assert.equal(isUnknownProtectedApi("/api/health/public", "portal"), false);
    assert.equal(isUnknownProtectedApi("/api/health/public", "studio"), false);
    assert.equal(isUnknownProtectedApi("/api/health/private", "portal"), false);
    assert.equal(isUnknownProtectedApi("/api/health/private", "studio"), false);
  });

  it("maps unified /studio and /players prefixes", () => {
    assert.equal(classifyRoute("/players/terra", "portal").access, "protected-session");
    assert.equal(requiresStudioAuth("/studio/brain"), true);
    assert.equal(requiresStudioAuth("/studio/api/health"), false);
  });

  it("maps /public-assets to protected asset file API", () => {
    assert.equal(classifyRoute("/public-assets/asset-123/file", "portal").access, "protected-session");
    assert.ok(matchesRoutePattern("/api/assets/asset-123/file", "/api/assets/*/file"));
  });

  it("detects guest wiki paths for legacy redirects and diagnostics", () => {
    assert.equal(isGuestWikiPath("/worlds"), true);
    assert.equal(isGuestWikiPath("/worlds/terra"), true);
    assert.equal(isGuestWikiPath("/players/terra"), true);
    assert.equal(isGuestWikiPath("/auth/worlds"), false);
  });
});

describe("login-first Portal regression", () => {
  it("portal root / requires a session (login-first)", () => {
    assert.equal(classifyRoute("/", "portal").access, "protected-session");
    assert.equal(requiresPortalSession("/"), true);
    assert.equal(isPublicRoute("/", "portal"), false);
  });

  it("/portal requires a session (login-first)", () => {
    assert.equal(classifyRoute("/portal", "portal").access, "protected-session");
    assert.equal(requiresPortalSession("/portal"), true);
    assert.equal(isPublicRoute("/portal", "portal"), false);
  });

  it("/worlds and /worlds/* require a session", () => {
    assert.equal(classifyRoute("/worlds", "portal").access, "protected-session");
    assert.equal(classifyRoute("/worlds/terra", "portal").access, "protected-session");
    assert.equal(requiresPortalSession("/worlds"), true);
    assert.equal(requiresPortalSession("/worlds/terra"), true);
  });

  it("/auth/* routes require a session", () => {
    assert.equal(classifyRoute("/auth/worlds", "portal").access, "protected-session");
    assert.equal(classifyRoute("/auth/worlds/terra", "portal").access, "protected-session");
    assert.equal(requiresPortalSession("/auth/worlds"), true);
  });

  it("login and forgot-password stay public (auth entrypoints)", () => {
    assert.equal(isPublicRoute("/login", "portal"), true);
    assert.equal(isPublicRoute("/forgot-password", "portal"), true);
    assert.equal(isPublicRoute("/reset-password", "portal"), true);
    assert.equal(requiresPortalSession("/login"), false);
  });
});