/**
 * Leak-prevention regression tests — visibility, secrets, and public exposure.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("security leaks — visibility and portal filtering", () => {
  const leakTests = [
    "packages/database/src/visibility-security.test.ts",
    "packages/database/src/search-service.test.ts",
    "packages/database/src/graph-service.test.ts",
    "packages/database/src/asset.test.ts",
    "packages/database/src/share-link.test.ts",
    "packages/auth/src/permissions.test.ts",
    "apps/portal/src/lib/share-access.test.ts",
  ];

  for (const testFile of leakTests) {
    it(`includes ${testFile}`, () => {
      assert.ok(fs.existsSync(path.join(root, testFile)), `Missing leak test: ${testFile}`);
    });
  }
});

describe("security leaks — player preview must not expose secrets", () => {
  it("masks secrets in settings service", () => {
    const source = read("packages/database/src/settings-service.ts");
    assert.match(source, /maskSecretsInUi/);
  });

  it("does not return AUTH_SECRET from runtime config to clients", () => {
    const portalAuth = read("apps/portal/src/lib/auth.ts");
    assert.doesNotMatch(portalAuth, /AUTH_SECRET/);
  });

  it("filters portal-invisible blocks in permissions", () => {
    const permissions = read("packages/database/src/permissions.ts");
    assert.match(permissions, /filterBlocksForContext/);
    assert.match(permissions, /isPortalBlockVisibility/);
  });
});

describe("security leaks — production safety flags", () => {
  it("warns when PLAYER_PREVIEW_ALLOW_DM_ONLY is enabled in production", () => {
    const source = read("packages/database/src/production-safety.ts");
    assert.match(source, /playerPreviewAllowDmOnly/);
  });

  it(".env is gitignored", () => {
    const gitignore = read(".gitignore");
    assert.match(gitignore, /^\.env$/m);
  });
});
