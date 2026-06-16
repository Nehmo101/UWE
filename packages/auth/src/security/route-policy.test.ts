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
  it("treats portal guest wiki routes as public", () => {
    assert.equal(isPublicRoute("/", "portal"), true);
    assert.equal(isPublicRoute("/worlds", "portal"), true);
    assert.equal(isPublicRoute("/worlds/terra", "portal"), true);
    assert.equal(isPublicRoute("/worlds/terra/orte/eldoria", "portal"), true);
    assert.equal(isPublicRoute("/players/terra", "portal"), true);
    assert.equal(isPublicRoute("/share/abc123", "portal"), true);
  });

  it("treats portal auth routes as session-protected", () => {
    const authWorlds = classifyRoute("/auth/worlds/terra", "portal");
    assert.equal(authWorlds.access, "protected-session");
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
  });

  it("maps unified /studio and /players prefixes", () => {
    assert.equal(isPublicRoute("/players/terra", "portal"), true);
    assert.equal(requiresStudioAuth("/studio/brain"), true);
    assert.equal(requiresStudioAuth("/studio/api/health"), false);
  });

  it("maps /public-assets to asset file API", () => {
    assert.equal(isPublicRoute("/public-assets/asset-123/file", "portal"), true);
    assert.ok(matchesRoutePattern("/api/assets/asset-123/file", "/api/assets/*/file"));
  });

  it("detects guest wiki paths", () => {
    assert.equal(isGuestWikiPath("/worlds"), true);
    assert.equal(isGuestWikiPath("/worlds/terra"), true);
    assert.equal(isGuestWikiPath("/players/terra"), true);
    assert.equal(isGuestWikiPath("/auth/worlds"), false);
  });
});
