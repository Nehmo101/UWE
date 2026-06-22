/**
 * Security boundary acceptance tests for UWE route policy and authorization.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { authorize } from "./authorize";
import { evaluatePortalMiddleware, evaluateStudioMiddleware } from "./middleware";
import {
  classifyRoute,
  isPublicRoute,
  isUnknownProtectedApi,
} from "./route-policy";

const root = path.resolve(import.meta.dirname, "../../../..");

function makeRequest(pathname: string, headers: Record<string, string> = {}) {
  return new Request(`https://uweanddragons.org${pathname}`, { headers });
}

function makeMiddlewareRequest(pathname: string, headers: Record<string, string> = {}) {
  return {
    pathname,
    url: `https://uweanddragons.org${pathname}`,
    headers: new Headers({ host: "uweanddragons.org", ...headers }),
    cookies: { get: () => undefined },
  };
}

describe("security boundary", () => {
  it("allows public player routes", () => {
    assert.equal(isPublicRoute("/", "portal"), true);
    assert.equal(isPublicRoute("/login", "portal"), true);
    assert.equal(isPublicRoute("/forgot-password", "portal"), true);
    assert.equal(isPublicRoute("/reset-password", "portal"), true);
    assert.equal(isPublicRoute("/worlds/terra", "portal"), true);
    assert.equal(isPublicRoute("/players/terra", "portal"), true);

    const decision = evaluatePortalMiddleware(makeMiddlewareRequest("/worlds/terra"), {
      ...process.env,
      NODE_ENV: "production",
      AUTH_REQUIRED: "false",
      PLAYER_PREVIEW_PUBLIC: "true",
      PUBLIC_APP_URL: "https://uweanddragons.org",
    });
    assert.equal(decision.action, "allow");
  });

  it("blocks protected studio routes without auth when publicly exposed", () => {
    const decision = evaluateStudioMiddleware(makeMiddlewareRequest("/admin/status"), {
      ...process.env,
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uweanddragons.org",
      CLOUDFLARE_TUNNEL: "true",
      STUDIO_API_TOKEN: "test-token",
    });
    assert.equal(decision.action, "block");
    assert.equal(decision.status, 401);
  });

  it("allows /setup without Authorization when publicly exposed with STUDIO_API_TOKEN", () => {
    assert.equal(isPublicRoute("/setup", "studio"), true);

    const decision = evaluateStudioMiddleware(
      makeMiddlewareRequest("/setup", { host: "127.0.0.1:3000" }),
      {
        ...process.env,
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uweanddragons.org",
        CLOUDFLARE_TUNNEL: "true",
        STUDIO_API_TOKEN: "test-token",
      },
    );
    assert.equal(decision.action, "allow");
  });

  it("blocks protected APIs without auth", () => {
    process.env.STUDIO_API_TOKEN = "test-token";

    const denied = authorize({
      scope: "studio-api",
      request: makeRequest("/api/import/execute", { host: "uweanddragons.org" }),
      pathname: "/api/import/execute",
    });
    assert.ok(denied);
    assert.equal(denied?.status, 401);

    delete process.env.STUDIO_API_TOKEN;
  });

  it("blocks or hides unknown API routes (deny-by-default)", () => {
    assert.equal(isUnknownProtectedApi("/api/not-implemented", "portal"), true);
    assert.equal(isUnknownProtectedApi("/api/not-implemented", "studio"), true);

    const portalDecision = evaluatePortalMiddleware(makeMiddlewareRequest("/api/not-implemented"), {
      ...process.env,
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uweanddragons.org",
    });
    assert.equal(portalDecision.action, "block");
    assert.equal(portalDecision.status, 404);
  });

  it("classifies player wiki routes as public with protected-session for auth area", () => {
    const guest = classifyRoute("/worlds/terra/orte/eldoria", "portal");
    assert.equal(guest.access, "public");

    const authArea = classifyRoute("/auth/worlds/terra", "portal");
    assert.equal(authArea.access, "protected-session");
  });

  it("allows public portal password reset APIs without session", () => {
    const forgotDenied = authorize({
      scope: "portal-api",
      request: makeRequest("/api/auth/forgot-password", {
        host: "uweanddragons.org",
        origin: "https://uweanddragons.org",
      }),
      pathname: "/api/auth/forgot-password",
      hasSession: false,
    });
    assert.equal(forgotDenied, null);

    const resetDenied = authorize({
      scope: "portal-api",
      request: makeRequest("/api/auth/reset-password", {
        host: "uweanddragons.org",
        origin: "https://uweanddragons.org",
      }),
      pathname: "/api/auth/reset-password",
      hasSession: false,
    });
    assert.equal(resetDenied, null);
  });

  it("documents that dm_only content is filtered at repository layer for portal", () => {
    const repoTest = fs.readFileSync(
      path.join(root, "packages/database/src/repository.test.ts"),
      "utf8",
    );
    assert.match(repoTest, /getPublicPageForPortal/);
    assert.match(repoTest, /dm_only|player_visible/);

    const searchTest = fs.readFileSync(
      path.join(root, "packages/database/src/search-service.test.ts"),
      "utf8",
    );
    assert.match(searchTest, /dm_only/);
    assert.match(searchTest, /players only allowed content/);
  });

  it("requires authorize() in all API route handlers", () => {
    const studioApiDir = path.join(root, "apps/studio/app/api");
    const portalApiDir = path.join(root, "apps/portal/app/api");

    const walk = (dir: string): string[] => {
      const results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...walk(full));
        } else if (entry.name === "route.ts") {
          results.push(full);
        }
      }
      return results;
    };

    for (const file of walk(studioApiDir)) {
      const content = fs.readFileSync(file, "utf8");
      if (
        file.includes("/api/auth/") ||
        file.endsWith("/health/public/route.ts") ||
        file.endsWith("/health/route.ts") ||
        file.endsWith("/spotify/callback/route.ts")
      ) {
        continue;
      }
      const needsAlternateGuard = file.endsWith("/health/private/route.ts");
      if (needsAlternateGuard) {
        assert.match(
          content,
          /requirePrivateHealthAuth|requireStudioApiAuth|requireAdminApiAuth|guardStudioMutation|requireAdminMailApi|requireAdminMailMutation/,
          `${file} must call an auth guard`,
        );
        continue;
      }
      assert.match(
        content,
        /requireStudioApiAuth|requireAdminApiAuth|guardStudioMutation|requireRestoreOwnerAuth|requireOwnerApiAuth|requireAdminMailApi|requireAdminMailMutation/,
        `${file} must call requireStudioApiAuth, requireAdminApiAuth, guardStudioMutation, requireRestoreOwnerAuth, requireOwnerApiAuth, or requireAdminMailApi`,
      );
    }

    const portalTwoFactorHelper = path.join(root, "apps/portal/src/lib/two-factor-routes.ts");

    for (const file of walk(portalApiDir)) {
      const content = fs.readFileSync(file, "utf8");
      if (file.endsWith("/health/public/route.ts") || file.endsWith("/health/route.ts")) {
        continue;
      }
      if (file.endsWith("/health/private/route.ts")) {
        assert.match(
          content,
          /requireOwnerAuth|requirePortalOwnerAuth|requirePortalApiAuth|requirePrivateHealthAuth/,
          `${file} must call an auth guard`,
        );
        continue;
      }
      if (
        file.includes("/api/auth/two-factor/") &&
        !file.endsWith("/verify/route.ts")
      ) {
        const helperContent = fs.readFileSync(portalTwoFactorHelper, "utf8");
        assert.match(
          helperContent,
          /requirePortalApiAuth/,
          `${file} delegates to two-factor-routes.ts which must call requirePortalApiAuth`,
        );
        continue;
      }
      assert.match(
        content,
        /requirePortalApiAuth|SESSION_COOKIE_NAME|requireOwnerAuth|requirePortalOwnerAuth/,
        `${file} must call requirePortalApiAuth or session auth`,
      );
    }
  });
});
