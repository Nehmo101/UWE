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
    "packages/database/src/password-security.test.ts",
    "packages/auth/src/password.test.ts",
    "packages/auth/src/permissions.test.ts",
    "apps/portal/src/lib/share-access.test.ts",
    "apps/portal/src/navigation/portal-nav.test.ts",
    "packages/database/src/atlas-service.test.ts",
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

  it("uses login-first portal navigation without public discovery hrefs", () => {
    const portalNav = read("apps/portal/src/navigation/portal-nav.ts");
    assert.doesNotMatch(portalNav, /Welten entdecken/);
    assert.doesNotMatch(portalNav, /href: "\/worlds"/);
  });
});

describe("security leaks — atlas portal visibility (three-tier: map + node + feature/object)", () => {
  it("enforces the three-tier dm_only filter server-side in the atlas service", () => {
    const atlas = read("packages/database/src/atlas-service.ts");
    // Predicate rejects dm_only and requires player-portal visibility …
    assert.match(atlas, /isAtlasEntityAccessible/);
    assert.match(atlas, /isDmOnlyVisibility/);
    assert.match(atlas, /isPlayerPortalVisibility/);
    // … and is applied across map, nodes, features and objects before serialization.
    assert.match(atlas, /filterAtlasEntities/);
    assert.match(atlas, /getAtlasForContext/);
  });

  it("serializes the static export atlas bundle through the portal filter", () => {
    const exportAtlas = read("packages/static-export/src/export-atlas.ts");
    assert.match(exportAtlas, /getAtlasForContext/);
    assert.match(exportAtlas, /["']portal["']/);
  });

  it("static export only ships approved palette items referenced by visible objects", () => {
    const exportAtlas = read("packages/static-export/src/export-atlas.ts");
    // Palette stamps carry AI/upload image data — pending items must never
    // reach the player-facing bundle, and only referenced ids may be resolved.
    assert.match(exportAtlas, /reviewStatus:\s*["']approved["']/);
    assert.match(exportAtlas, /id:\s*\{\s*in:/);
  });

  it("static export takes the tile layer from the portal-filtered map snapshot only", () => {
    const exportAtlas = read("packages/static-export/src/export-atlas.ts");
    // tileLayer lives on AtlasMap; the snapshot is null when the map is not
    // portal-visible, so reading it off snapshot.map keeps the gate intact.
    assert.match(exportAtlas, /snapshot\.map\.tileLayer/);
    assert.doesNotMatch(exportAtlas, /atlasMap\.findUnique/);
  });

  it("fetches portal atlas node data through the portal filter", () => {
    const nodePage = read("apps/portal/app/auth/worlds/[worldSlug]/atlas/[nodeId]/page.tsx");
    assert.match(nodePage, /getAtlasForContext/);
    assert.match(nodePage, /["']portal["']/);
  });

  it("single-file runtime never renders local/demo data in view mode (only server-injected, filtered docs)", () => {
    const runtime = read("packages/static-export/static/atlas.html");
    // View mode must short-circuit to an empty world BEFORE any localStorage/demo read …
    assert.match(runtime, /if \(isView\(\)\) return migrate\(emptyDoc\(\)\)/);
    // … and only accept a server-provided (already-filtered) doc via injection.
    assert.match(runtime, /readInjectedDoc/);
    assert.match(runtime, /getElementById\("atlas-doc"\)/);
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
