import path from "node:path";
import fs from "node:fs";
import {
  assertRouteProtected,
  listApiRouteFiles,
  type RouteProtectionPolicy,
} from "./route-inventory-core";

export const PORTAL_API_ROOT = "apps/portal/app/api";

/**
 * Accepted Portal guard references. The Portal funnels almost every route
 * through the central `requirePortalApiAuth` guard (CSRF + `authorize({ scope:
 * "portal-api" })`); a few routes enforce auth with a purpose-built guard
 * instead:
 *
 * - `requirePortalApiAuth`   — central Portal API guard (`@/src/lib/portal-api-auth`
 *                              and the CSRF-only re-export from `@uwe/security`).
 * - `requirePortalOwnerAuth` — global-owner-only guard (private health).
 * - `canViewAuditLog`        — in-handler RBAC gate for the portal audit log.
 * - `hasAnyRole`             — in-handler role gate for owner/admin-only world creation.
 */
export const PORTAL_AUTH_GUARD_PATTERN =
  /requirePortalApiAuth|requirePortalOwnerAuth|canViewAuditLog|hasAnyRole/;

/**
 * Genuinely-public Portal endpoints that intentionally carry no auth guard.
 * Each mirrors an equivalent public Studio endpoint and leaks no world data:
 *
 * - `health/public/route.ts`      — plain-text uptime probe, no internal detail.
 * - `maintenance/evaluate/route.ts` — maintenance decision for a path/surface (middleware helper).
 * - `maintenance/status/route.ts` — maintenance flag snapshot (middleware helper).
 */
export const PORTAL_PUBLIC_API_ALLOWLIST = new Set([
  "health/public/route.ts",
  "maintenance/evaluate/route.ts",
  "maintenance/status/route.ts",
]);

/**
 * Portal two-factor routes that delegate their auth to the shared
 * `apps/portal/src/lib/two-factor-routes.ts` helper (which calls
 * `requirePortalApiAuth` via `requireSessionUser`). The `verify` route is NOT
 * delegated — it guards itself directly — so it is deliberately absent here.
 */
export const PORTAL_DELEGATED_GUARD_ROUTES = new Set([
  "auth/two-factor/route.ts",
  "auth/two-factor/setup/route.ts",
  "auth/two-factor/activate/route.ts",
  "auth/two-factor/disable/route.ts",
]);

export function listPortalApiRouteFiles(repoRoot: string): string[] {
  return listApiRouteFiles(path.join(repoRoot, PORTAL_API_ROOT));
}

export function listPortalApiRoutePaths(repoRoot: string): string[] {
  return listPortalApiRouteFiles(repoRoot).map(
    (relative) => `/api/${relative.replace(/\/route\.ts$/, "")}`,
  );
}

export function readPortalRouteSource(repoRoot: string, relativeRoute: string): string {
  return fs.readFileSync(path.join(repoRoot, PORTAL_API_ROOT, relativeRoute), "utf8");
}

function portalPolicy(twoFactorHelperPath: string): RouteProtectionPolicy {
  return {
    guardPattern: PORTAL_AUTH_GUARD_PATTERN,
    publicAllowlist: PORTAL_PUBLIC_API_ALLOWLIST,
    delegated: {
      routes: PORTAL_DELEGATED_GUARD_ROUTES,
      helperPath: twoFactorHelperPath,
    },
  };
}

export function assertPortalRouteProtected(
  repoRoot: string,
  relativeRoute: string,
  twoFactorHelperPath: string,
): void {
  assertRouteProtected(
    path.join(repoRoot, PORTAL_API_ROOT),
    relativeRoute,
    portalPolicy(twoFactorHelperPath),
  );
}

export function listProtectedPortalApiRoutes(repoRoot: string): string[] {
  return listPortalApiRouteFiles(repoRoot).filter(
    (route) => !PORTAL_PUBLIC_API_ALLOWLIST.has(route),
  );
}
