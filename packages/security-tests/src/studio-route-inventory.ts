import path from "node:path";
import fs from "node:fs";
import {
  assertRouteProtected,
  listApiRouteFiles,
  type RouteProtectionPolicy,
} from "./route-inventory-core";

export const STUDIO_API_ROOT = "apps/studio/app/api";

export const STUDIO_PUBLIC_API_ALLOWLIST = new Set([
  "auth/login/route.ts",
  // Landing-page (uweanddragons.org) unified sign-in — authenticates in-place
  // for the Studio or Portal target; access is enforced inside the handler.
  "auth/enter/route.ts",
  "auth/logout/route.ts",
  "auth/setup/route.ts",
  "auth/forgot-password/route.ts",
  "auth/reset-password/route.ts",
  "auth/two-factor/verify/route.ts",
  "health/route.ts",
  "health/public/route.ts",
  "maintenance/status/route.ts",
  "maintenance/evaluate/route.ts",
  "spotify/callback/route.ts",
]);

export const STUDIO_DELEGATED_GUARD_ROUTES = new Set([
  "auth/two-factor/route.ts",
  "auth/two-factor/setup/route.ts",
  "auth/two-factor/activate/route.ts",
  "auth/two-factor/disable/route.ts",
]);

/** Intentionally public read-only Studio endpoints (health, generator UI helpers). */
export const STUDIO_PUBLIC_READ_API_ROUTES = new Set([
  "import/formats/route.ts",
]);

export const STUDIO_AUTH_GUARD_PATTERN =
  /requireStudioApiAuth|requireAdminApiAuth|guardStudioMutation|guardStudioApiRequest|guardStudioApiMutation|guardStudioAdminApiRequest|requireRestoreOwnerAuth|requireOwnerApiAuth|requirePrivateHealthAuth|requireAdminMailApi|requireAdminMailMutation|requireAgentJobCallbackAuth|authenticateConnector/;

export function listStudioApiRouteFiles(repoRoot: string): string[] {
  return listApiRouteFiles(path.join(repoRoot, STUDIO_API_ROOT));
}

export function listStudioApiRoutePaths(repoRoot: string): string[] {
  return listStudioApiRouteFiles(repoRoot).map((relative) => `/api/${relative.replace(/\/route\.ts$/, "")}`);
}

export function readStudioRouteSource(repoRoot: string, relativeRoute: string): string {
  return fs.readFileSync(path.join(repoRoot, STUDIO_API_ROOT, relativeRoute), "utf8");
}

function studioPolicy(twoFactorHelperPath: string): RouteProtectionPolicy {
  return {
    guardPattern: STUDIO_AUTH_GUARD_PATTERN,
    publicAllowlist: STUDIO_PUBLIC_API_ALLOWLIST,
    delegated: {
      routes: STUDIO_DELEGATED_GUARD_ROUTES,
      helperPath: twoFactorHelperPath,
    },
  };
}

export function assertStudioRouteProtected(
  repoRoot: string,
  relativeRoute: string,
  twoFactorHelperPath: string,
): void {
  assertRouteProtected(
    path.join(repoRoot, STUDIO_API_ROOT),
    relativeRoute,
    studioPolicy(twoFactorHelperPath),
  );
}

export function listProtectedStudioApiRoutes(repoRoot: string): string[] {
  return listStudioApiRouteFiles(repoRoot).filter(
    (route) =>
      !STUDIO_PUBLIC_API_ALLOWLIST.has(route) &&
      !STUDIO_PUBLIC_READ_API_ROUTES.has(route),
  );
}
