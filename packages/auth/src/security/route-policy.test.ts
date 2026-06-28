import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyRoute,
  isGuestWikiPath,
  isPublicRoute,
  isUnknownProtectedApi,
  matchesRoutePattern,
  requiresStudioAuth,
} from "./route-policy";

describe("route policy", () => {
  it("keeps only portal auth entrypoints public", () => {
    assert.equal(isPublicRoute("/login", "portal"), true);
    assert.equal(isPublicRoute("/forgot-password", "portal"), true);
    assert.equal(isPublicRoute("/reset-password", "portal"), true);
    assert.equal(isPublicRoute("/", "portal"), false);
    assert.equal(isPublicRoute("/worlds", "portal"), false);
    assert.equal(isPublicRoute("/worlds/terra", "portal"), false);
    assert.equal(isPublicRoute("/players/terra", "portal"), false);
    assert.equal(isPublicRoute("/share/abc123", "portal"), false);
  });

  it("treats portal app content routes as session-protected", () => {
    for (const path of ["/", "/portal", "/worlds", "/worlds/terra", "/players/terra", "/share/abc123"]) {
      assert.equal(classifyRoute(path, "portal").access, "protected-session", path);
    }
  });

  it("treats portal auth routes as session-protected", () => {
    const authWorlds = classifyRoute("/auth/worlds/terra", "portal");
    assert.equal(authWorlds.access, "protected-session");
    assert.equal(classifyRoute("/api/auth/preview", "portal").access, "protected-session");
    assert.equal(classifyRoute("/api/auth/two-factor", "portal").access, "protected-session");
    assert.equal(classifyRoute("/api/auth/two-factor/setup", "portal").access, "protected-session");
    assert.equal(classifyRoute("/api/worlds", "portal").access, "protected-session");
  });

  it("treats dashboard, graph, share and asset portal APIs as session-protected", () => {
    for (const path of [
      "/api/dashboard-layout/portal:world:terra",
      "/api/worlds/terra/graph",
      "/api/share/abc123",
      "/api/assets/asset-123/file",
    ]) {
      assert.equal(classifyRoute(path, "portal").access, "protected-session", path);
      assert.equal(isUnknownProtectedApi(path, "portal"), false, path);
    }
  });

  it("treats studio session auth routes as protected-session", () => {
    assert.equal(classifyRoute("/api/auth/two-factor", "studio").access, "protected-session");
    assert.equal(classifyRoute("/api/auth/two-factor/setup", "studio").access, "protected-session");
    assert.equal(classifyRoute("/api/auth/change-password", "studio").access, "protected-session");
    assert.equal(classifyRoute("/api/dashboard-layout/studio:today", "studio").access, "protected-session");
    assert.equal(classifyRoute("/api/worlds", "studio").access, "protected-session");
    assert.equal(isUnknownProtectedApi("/api/auth/two-factor", "studio"), false);
    assert.equal(isUnknownProtectedApi("/api/dashboard-layout/studio:today", "studio"), false);
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