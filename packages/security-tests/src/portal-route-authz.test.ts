/**
 * Ensures every Portal API route is protected or explicitly allowlisted.
 *
 * The Portal exists to show only filtered, released content, so a new or
 * modified route that forgets the guard pattern is a privacy regression. This
 * mirrors the Studio API inventory (`studio-route-inventory.ts`) route-for-route
 * so both surfaces are held to the same static guarantee.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  assertPortalRouteProtected,
  listPortalApiRouteFiles,
  listProtectedPortalApiRoutes,
  PORTAL_API_ROOT,
  PORTAL_AUTH_GUARD_PATTERN,
  PORTAL_DELEGATED_GUARD_ROUTES,
  PORTAL_PUBLIC_API_ALLOWLIST,
} from "./portal-route-inventory";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const TWO_FACTOR_ROUTES_HELPER = path.join(repoRoot, "apps/portal/src/lib/two-factor-routes.ts");

function readRoute(relativeRoute: string): string {
  return fs.readFileSync(path.join(repoRoot, PORTAL_API_ROOT, relativeRoute), "utf8");
}

describe("Portal API route auth inventory", () => {
  const routes = listPortalApiRouteFiles(repoRoot);

  it("discovers the full Portal API surface", () => {
    // Sanity floor to catch a broken discovery walk (e.g. returning 0), not an
    // exact count — the Portal route set changes with normal feature work.
    assert.ok(routes.length >= 20, `expected the full Portal API surface, got ${routes.length}`);
  });

  it("delegated + public + guarded routes account for the whole surface", () => {
    const guarded = routes.filter(
      (route) =>
        !PORTAL_PUBLIC_API_ALLOWLIST.has(route) && !PORTAL_DELEGATED_GUARD_ROUTES.has(route),
    );
    const covered = guarded.length + PORTAL_PUBLIC_API_ALLOWLIST.size + PORTAL_DELEGATED_GUARD_ROUTES.size;
    assert.equal(covered, routes.length, "every Portal route must be guarded, delegated, or allowlisted");
  });

  for (const relativeRoute of routes) {
    it(`${relativeRoute} is protected or explicitly allowlisted`, () => {
      assert.doesNotThrow(() =>
        assertPortalRouteProtected(repoRoot, relativeRoute, TWO_FACTOR_ROUTES_HELPER),
      );
    });
  }
});

describe("Portal guarded routes reference a recognized guard", () => {
  const nonDelegatedProtected = listProtectedPortalApiRoutes(repoRoot).filter(
    (route) => !PORTAL_DELEGATED_GUARD_ROUTES.has(route),
  );

  for (const route of nonDelegatedProtected) {
    it(`${route} references a Portal auth guard`, () => {
      assert.match(readRoute(route), PORTAL_AUTH_GUARD_PATTERN);
    });
  }
});

describe("Portal delegated two-factor routes guard via shared helper", () => {
  it("delegated routes exist and the helper enforces auth", () => {
    const helper = fs.readFileSync(TWO_FACTOR_ROUTES_HELPER, "utf8");
    assert.match(helper, PORTAL_AUTH_GUARD_PATTERN);

    for (const route of PORTAL_DELEGATED_GUARD_ROUTES) {
      const source = readRoute(route);
      // The route file itself is a thin delegate to the helper.
      assert.match(source, /two-factor-routes/);
    }
  });
});

describe("Portal public allowlist is genuinely public", () => {
  for (const route of PORTAL_PUBLIC_API_ALLOWLIST) {
    it(`${route} exists and carries no auth guard`, () => {
      assert.ok(
        fs.existsSync(path.join(repoRoot, PORTAL_API_ROOT, route)),
        `Missing public route: ${route}`,
      );
      assert.doesNotMatch(readRoute(route), PORTAL_AUTH_GUARD_PATTERN);
    });
  }
});
