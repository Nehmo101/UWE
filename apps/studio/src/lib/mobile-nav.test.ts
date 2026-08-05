import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { studioNavItems } from "../navigation/studio-nav";
import { worldNavItems } from "../navigation/world-nav";
import { studioGlobalBottomNav, studioWorldBottomNav, resolveStudioBottomNav } from "./mobile-nav";

const STUDIO_NAV_HREFS = new Set(
  studioNavItems()
    .filter((item) => item.status === "active")
    .map((item) => item.href.split("?")[0]!),
);

function worldNavHrefExists(worldSlug: string, href: string): boolean {
  const pathname = href.split("?")[0]!;
  return worldNavItems(worldSlug).some((item) => item.href.split("?")[0] === pathname);
}

describe("studio mobile nav", () => {
  it("uses exactly the three primary Studio areas", () => {
    const nav = studioGlobalBottomNav("worlds");
    assert.deepEqual(
      nav.map((item) => item.label),
      ["Welten", "Suche", "Konto"],
    );
    assert.equal(nav.length, 3);
    assert.equal(nav[0]?.active, true);
    assert.equal(nav[0]?.href, "/worlds");
    assert.equal(nav[1]?.href, "/search");
    assert.equal(nav[2]?.href, "/account/password");
  });

  it("maps global bottom nav hrefs into the central Studio IA", () => {
    for (const item of studioGlobalBottomNav("worlds")) {
      if (!item.href) continue;
      const pathname = item.href.split("?")[0]!;
      assert.ok(STUDIO_NAV_HREFS.has(pathname), `mobile nav href missing from IA: ${pathname}`);
    }
  });

  it("keeps legacy active keys mapped into the reduced global nav", () => {
    assert.equal(studioGlobalBottomNav("search")[1]?.active, true);
    assert.equal(studioGlobalBottomNav("more")[2]?.active, true);
    // „Medien & KI" gibt es global nicht mehr — KI und Brain liegen in der
    // Welt. Der alte Schlüssel darf keinen Tab hervorheben, den es nicht gibt.
    assert.equal(studioGlobalBottomNav("ai")[0]?.active, true);
    assert.equal(studioGlobalBottomNav("media-ai")[0]?.active, true);
  });

  it("uses world-scoped bottom nav with sidebar fallback", () => {
    const nav = studioWorldBottomNav("terra", "more");
    assert.deepEqual(
      nav.map((item) => item.label),
      ["Übersicht", "Inhalte", "Sessions", "Tools", "Mehr"],
    );
    assert.equal(nav.length, 5);
    assert.equal(nav[0]?.href, "/worlds/terra/dashboard");
    assert.equal(nav[1]?.href, "/worlds/terra/wiki");
    assert.equal(nav[2]?.href, "/worlds/terra/sessions");
    assert.equal(nav[3]?.href, "/worlds/terra/brain");
    assert.equal(nav[4]?.action, "open-sidebar");
  });

  it("maps world bottom nav hrefs into the central world IA", () => {
    for (const item of studioWorldBottomNav("terra", "overview")) {
      if (!item.href) continue;
      assert.ok(
        worldNavHrefExists("terra", item.href),
        `world mobile nav href missing from IA: ${item.href}`,
      );
    }
  });

  it("highlights active world bottom nav tab", () => {
    const contentNav = studioWorldBottomNav("terra", "content");
    assert.equal(contentNav[1]?.active, true);
    const sessionsNav = studioWorldBottomNav("terra", "sessions");
    assert.equal(sessionsNav[2]?.active, true);
    const toolsNav = studioWorldBottomNav("terra", "tools");
    assert.equal(toolsNav[3]?.active, true);
    const moreNav = studioWorldBottomNav("terra", "more");
    assert.equal(moreNav[4]?.active, true);
  });

  it("resolves the same global nav everywhere — the Daily-Admin variant is Brain's now", () => {
    const worldNav = resolveStudioBottomNav("/worlds/terra/dashboard");
    assert.deepEqual(
      worldNav.map((item) => item.label),
      ["Welten", "Suche", "Konto"],
    );
    assert.equal(worldNav[0]?.active, true);

    assert.equal(resolveStudioBottomNav("/search?scope=admin")[1]?.active, true);
    assert.equal(resolveStudioBottomNav("/account/password")[2]?.active, true);
    assert.equal(resolveStudioBottomNav("/admin")[2]?.active, true);
  });
});

