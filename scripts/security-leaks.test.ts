/**
 * Leak-prevention regression tests — access, secrets, and public exposure.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("security leaks — access and portal filtering", () => {
  // Per-item visibility and share links are gone (Notiz Lasse, 2026-07-26), so
  // their tests are too. What is left guards the one rule: world assignment.
  const leakTests = [
    "packages/database/src/search-service.test.ts",
    "packages/database/src/graph-service.test.ts",
    "packages/database/src/asset.test.ts",
    "packages/database/src/password-security.test.ts",
    "packages/auth/src/password.test.ts",
    "packages/auth/src/permissions.test.ts",
    "packages/auth/src/area-access.test.ts",
    "packages/auth/src/security/authz.test.ts",
    "apps/portal/src/lib/world-access.test.ts",
    "apps/portal/src/navigation/portal-nav.test.ts",
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

  it("gates world content on assignment, with no per-item filter left", () => {
    const permissions = read("packages/auth/src/permissions.ts");
    assert.match(permissions, /canViewWorldContent/);
    assert.match(permissions, /ctx\.worldMembership !== null/);
    // The visibility enum must not come back through a side door. Match the
    // quoted literals, so the comment that explains their removal still reads.
    assert.doesNotMatch(permissions, /"(dm_only|player_visible)"/);
  });

  it("keeps the world boundary load-bearing in scopeFromAccessContext", () => {
    const authz = read("packages/auth/src/security/authz.ts");
    assert.match(
      authz,
      /ctx\.worldMembership\?\.worldId === worldId/,
      "a membership must never carry over into a different world",
    );
  });

  it("uses login-first portal navigation without public discovery hrefs", () => {
    const portalNav = read("apps/portal/src/navigation/portal-nav.ts");
    assert.doesNotMatch(portalNav, /Welten entdecken/);
    assert.doesNotMatch(portalNav, /href: "\/worlds"/);
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
