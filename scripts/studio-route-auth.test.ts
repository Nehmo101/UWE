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
  "health/route.ts",
  "spotify/callback/route.ts",
]);

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
          /requireStudioApiAuth|requireRestoreOwnerAuth/,
          `${route} is public allowlist — must not import auth guard`,
        );
        return;
      }

      const protectedByStudioAuth = content.includes("requireStudioApiAuth");
      const protectedByRestoreAuth = content.includes("requireRestoreOwnerAuth");

      assert.ok(
        protectedByStudioAuth || protectedByRestoreAuth,
        `${route} must call requireStudioApiAuth or requireRestoreOwnerAuth`,
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
