/**
 * Ensures every Studio API route is protected or explicitly allowlisted.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const studioApiRoot = path.join(root, "apps/studio/app/api");

const PUBLIC_ALLOWLIST = new Set([
  "auth/login/route.ts",
  "auth/logout/route.ts",
  "auth/setup/route.ts",
  "auth/forgot-password/route.ts",
  "auth/reset-password/route.ts",
  "auth/two-factor/verify/route.ts",
  "health/route.ts",
  "health/public/route.ts",
  "spotify/callback/route.ts",
]);

const DELEGATED_GUARD_ROUTES = new Set([
  "auth/two-factor/route.ts",
  "auth/two-factor/setup/route.ts",
  "auth/two-factor/activate/route.ts",
  "auth/two-factor/disable/route.ts",
]);

const TWO_FACTOR_ROUTES_HELPER = path.join(
  root,
  "apps/studio/src/lib/two-factor-routes.ts",
);

const AUTH_GUARD_PATTERN =
  /requireStudioApiAuth|requireAdminApiAuth|guardStudioMutation|requireRestoreOwnerAuth|requireOwnerApiAuth|requirePrivateHealthAuth|requireAdminMailApi|requireAdminMailMutation|requireAgentJobCallbackAuth/;

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

describe("Studio API route auth inventory", () => {
  const routes = listRouteFiles(studioApiRoot);

  it("finds Studio API routes", () => {
    assert.ok(routes.length >= 50, `expected many routes, got ${routes.length}`);
  });

  for (const route of routes) {
    it(`${route} is protected or allowlisted`, () => {
      const content = fs.readFileSync(path.join(studioApiRoot, route), "utf8");

      if (PUBLIC_ALLOWLIST.has(route)) {
        assert.doesNotMatch(
          content,
          AUTH_GUARD_PATTERN,
          `${route} is public allowlist — must not import auth guard`,
        );
        return;
      }

      if (DELEGATED_GUARD_ROUTES.has(route)) {
        const helperContent = fs.readFileSync(TWO_FACTOR_ROUTES_HELPER, "utf8");
        assert.ok(
          AUTH_GUARD_PATTERN.test(helperContent),
          `${route} delegates to two-factor-routes.ts which must call an auth guard`,
        );
        return;
      }

      assert.ok(
        AUTH_GUARD_PATTERN.test(content),
        `${route} must call requireStudioApiAuth, guardStudioMutation, requireRestoreOwnerAuth, requireOwnerApiAuth, requirePrivateHealthAuth, or requireAgentJobCallbackAuth`,
      );
    });
  }
});

describe("Studio restore route uses owner guard", () => {
  it("restore execute requires owner auth helper", () => {
    const content = fs.readFileSync(
      path.join(studioApiRoot, "backup/restore/execute/route.ts"),
      "utf8",
    );
    assert.match(content, /requireRestoreOwnerAuth/);
  });
});
