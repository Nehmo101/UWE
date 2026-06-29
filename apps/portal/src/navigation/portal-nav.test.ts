import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PORTAL_NAV,
  portalNavConflicts,
  portalNavItems,
  portalSidebar,
  portalWorldNav,
} from "./portal-nav";

describe("portal navigation (login-first)", () => {
  it("does not expose a public 'Welten entdecken' discovery flow", () => {
    const items = portalNavItems("terra");
    assert.ok(!items.some((item) => item.href === "/worlds"));
    assert.ok(!items.some((item) => item.label.toLowerCase().includes("entdecken")));
    assert.ok(!items.some((item) => item.permission.includes("public")));
  });

  it("includes 'Meine Welten' as the primary destination", () => {
    assert.ok(PORTAL_NAV.flatMap((g) => g.items).some((item) => item.href === "/auth/worlds"));
  });

  it("has no duplicate ids/hrefs/labels (with and without a world)", () => {
    for (const conflicts of [portalNavConflicts(), portalNavConflicts("terra")]) {
      assert.deepEqual(conflicts.duplicateIds, []);
      assert.deepEqual(conflicts.duplicateHrefs, []);
      assert.deepEqual(conflicts.duplicateLabels, []);
    }
  });

  it("adds world-scoped navigation only when a world is selected", () => {
    assert.equal(portalSidebar("/auth/worlds").length, PORTAL_NAV.length);
    assert.equal(portalSidebar("/auth/worlds/terra", "terra").length, PORTAL_NAV.length + 1);
  });

  it("world nav items live under /auth/worlds/[slug]", () => {
    for (const item of portalWorldNav("terra").flatMap((g) => g.items)) {
      assert.ok(item.href.startsWith("/auth/worlds/terra"), `${item.id} -> ${item.href}`);
    }
  });
});
