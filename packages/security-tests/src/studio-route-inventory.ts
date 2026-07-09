import fs from "node:fs";
import path from "node:path";

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
  const studioApiRoot = path.join(repoRoot, STUDIO_API_ROOT);
  return listRouteFiles(studioApiRoot).sort();
}

export function listStudioApiRoutePaths(repoRoot: string): string[] {
  return listStudioApiRouteFiles(repoRoot).map((relative) => `/api/${relative.replace(/\/route\.ts$/, "")}`);
}

function listRouteFiles(dir: string, prefix = ""): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRouteFiles(full, relative));
      continue;
    }
    if (entry.name === "route.ts") {
      files.push(relative);
    }
  }

  return files;
}

export function readStudioRouteSource(repoRoot: string, relativeRoute: string): string {
  return fs.readFileSync(path.join(repoRoot, STUDIO_API_ROOT, relativeRoute), "utf8");
}

export function assertStudioRouteProtected(
  repoRoot: string,
  relativeRoute: string,
  twoFactorHelperPath: string,
): void {
  const content = readStudioRouteSource(repoRoot, relativeRoute);

  if (STUDIO_PUBLIC_API_ALLOWLIST.has(relativeRoute)) {
    if (STUDIO_AUTH_GUARD_PATTERN.test(content)) {
      throw new Error(`${relativeRoute} is public allowlist — must not import auth guard`);
    }
    return;
  }

  if (STUDIO_DELEGATED_GUARD_ROUTES.has(relativeRoute)) {
    const helperContent = fs.readFileSync(twoFactorHelperPath, "utf8");
    if (!STUDIO_AUTH_GUARD_PATTERN.test(helperContent)) {
      throw new Error(
        `${relativeRoute} delegates to two-factor-routes.ts which must call an auth guard`,
      );
    }
    return;
  }

  if (!STUDIO_AUTH_GUARD_PATTERN.test(content)) {
    throw new Error(`${relativeRoute} must call a Studio auth guard`);
  }
}

export function listProtectedStudioApiRoutes(repoRoot: string): string[] {
  return listStudioApiRouteFiles(repoRoot).filter(
    (route) =>
      !STUDIO_PUBLIC_API_ALLOWLIST.has(route) &&
      !STUDIO_PUBLIC_READ_API_ROUTES.has(route),
  );
}
