import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { portalNavItems, portalWorldNav } from "../navigation/portal-nav";
import { portalAuthBottomNav } from "./mobile-nav";

function portalNavHrefExists(href: string, worldSlug: string | null): boolean {
  const pathname = href.split("?")[0]!;
  return portalNavItems(worldSlug).some((item) => item.href.split("?")[0] === pathname);
}

describe("portal mobile nav (login-first contract)", () => {
  it("anchors authenticated bottom nav on Meine Welten", () => {
    const nav = portalAuthBottomNav(null, "worlds");
    assert.equal(nav[0]?.href, "/auth/worlds");
    assert.equal(nav[0]?.active, true);
    assert.ok(!nav.some((item) => item.href === "/worlds"));
  });

  it("maps auth bottom nav hrefs into the central Portal IA", () => {
    const nav = portalAuthBottomNav("terra", "sessions");
    for (const item of nav) {
      if (!item.href) continue;
      assert.ok(
        portalNavHrefExists(item.href, "terra"),
        `portal mobile nav href missing from IA: ${item.href}`,
      );
    }
  });

  it("includes world-scoped destinations from portalWorldNav when a world is selected", () => {
    const worldHrefs = new Set(
      portalWorldNav("terra")
        .flatMap((group) => group.items)
        .map((item) => item.href.split("?")[0]!),
    );
    const nav = portalAuthBottomNav("terra", "handouts");
    for (const item of nav) {
      if (!item.href?.startsWith("/auth/worlds/terra")) continue;
      const pathname = item.href.split("?")[0]!;
      assert.ok(worldHrefs.has(pathname), `world mobile href not in portalWorldNav: ${pathname}`);
    }
  });
});
