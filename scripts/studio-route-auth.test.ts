/**
 * Ensures every Studio API route is protected or explicitly allowlisted.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  assertStudioRouteProtected,
  listStudioApiRouteFiles,
  STUDIO_AUTH_GUARD_PATTERN,
} from "../packages/security-tests/src/studio-route-inventory";

const root = path.resolve(import.meta.dirname, "..");
const TWO_FACTOR_ROUTES_HELPER = path.join(root, "apps/studio/src/lib/two-factor-routes.ts");

describe("Studio API route auth inventory", () => {
  const routes = listStudioApiRouteFiles(root);

  it("finds Studio API routes", () => {
    assert.ok(routes.length >= 50, `expected many routes, got ${routes.length}`);
  });

  for (const route of routes) {
    it(`${route} is protected or allowlisted`, () => {
      assert.doesNotThrow(() =>
        assertStudioRouteProtected(root, route, TWO_FACTOR_ROUTES_HELPER),
      );
    });
  }
});

describe("Studio restore route uses owner guard", () => {
  it("restore execute requires owner auth helper", () => {
    const content = fs.readFileSync(
      path.join(root, "apps/studio/app/api/backup/restore/execute/route.ts"),
      "utf8",
    );
    assert.match(content, /requireRestoreOwnerAuth/);
  });
});

describe("Studio auth guard pattern completeness", () => {
  it("includes restore, health, and connector guards", () => {
    const pattern = STUDIO_AUTH_GUARD_PATTERN.source;
    assert.match(pattern, /requireRestoreOwnerAuth/);
    assert.match(pattern, /requirePrivateHealthAuth/);
    assert.match(pattern, /authenticateConnector/);
  });
});
