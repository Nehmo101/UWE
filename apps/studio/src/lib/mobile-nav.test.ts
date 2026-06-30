import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { studioNavItems } from "../navigation/studio-nav";
import { worldNavItems } from "../navigation/world-nav";
import { studioGlobalBottomNav, studioWorldBottomNav, studioAdminBottomNav, resolveStudioBottomNav } from "./mobile-nav";
import { resolvePreferredWorldSlug } from "./today-dashboard";

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
  it("uses exactly the five primary Studio areas", () => {
    const nav = studioGlobalBottomNav("today");
    assert.deepEqual(
      nav.map((item) => item.label),
      ["Heute", "Welten", "Erstellen", "Medien & KI", "System"],
    );
    assert.equal(nav.length, 5);
    assert.equal(nav[0]?.active, true);
    assert.equal(nav[0]?.href, "/today");
    assert.equal(nav[1]?.href, "/worlds");
    assert.equal(nav[2]?.href, "/capture");
    assert.equal(nav[3]?.href, "/ai");
    assert.equal(nav[4]?.href, "/system");
  });

  it("maps global bottom nav hrefs into the central Studio IA", () => {
    for (const item of studioGlobalBottomNav("today")) {
      if (!item.href) continue;
      const pathname = item.href.split("?")[0]!;
      assert.ok(STUDIO_NAV_HREFS.has(pathname), `mobile nav href missing from IA: ${pathname}`);
    }
  });

  it("keeps legacy active keys mapped into the reduced global nav", () => {
    assert.equal(studioGlobalBottomNav("capture")[2]?.active, true);
    assert.equal(studioGlobalBottomNav("search")[1]?.active, true);
    assert.equal(studioGlobalBottomNav("ai")[3]?.active, true);
    assert.equal(studioGlobalBottomNav("more")[4]?.active, true);
  });

  it("uses world-scoped bottom nav with sidebar fallback", () => {
    const nav = studioWorldBottomNav("terra", "more");
    assert.deepEqual(
      nav.map((item) => item.label),
      ["Übersicht", "Inhalte", "Sessions", "Tools", "Mehr"],
    );
    assert.equal(nav.length, 5);
    assert.equal(nav[0]?.href, "/worlds/terra/dashboard");
    assert.equal(nav[1]?.href, "/worlds/terra");
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

  it("uses Daily Admin OS bottom nav with five tabs", () => {
    const nav = studioAdminBottomNav("capture");
    assert.deepEqual(
      nav.map((item) => item.label),
      ["Heute", "Capture", "Suche", "KI", "Mehr"],
    );
    assert.equal(nav.length, 5);
    assert.equal(nav[1]?.active, true);
    assert.equal(nav[1]?.href, "/capture");
    assert.equal(nav[2]?.href, "/search?scope=admin");
    assert.equal(nav[3]?.href, "/life-brain");
    assert.equal(nav[4]?.href, "/system");
  });

  it("resolves admin nav for Daily Admin OS paths", () => {
    const todayNav = resolveStudioBottomNav("/today");
    assert.equal(todayNav[0]?.active, true);
    assert.equal(todayNav[0]?.href, "/today");

    const projectNav = resolveStudioBottomNav("/projects/abc");
    assert.equal(projectNav[4]?.active, true);
    assert.equal(projectNav[4]?.href, "/system");

    const searchNav = resolveStudioBottomNav("/search?scope=admin");
    assert.equal(searchNav[2]?.active, true);
  });

  it("falls back to global nav outside admin paths", () => {
    const nav = resolveStudioBottomNav("/worlds/terra/dashboard");
    assert.deepEqual(
      nav.map((item) => item.label),
      ["Heute", "Welten", "Erstellen", "Medien & KI", "System"],
    );
    assert.equal(nav[1]?.active, true);
  });
});

describe("resolvePreferredWorldSlug", () => {
  it("uses PREFERRED_WORLD_SLUG when set", () => {
    const slug = resolvePreferredWorldSlug(
      [{ slug: "terra" }, { slug: "other" }],
      { env: { PREFERRED_WORLD_SLUG: "other", NODE_ENV: "test" } },
    );
    assert.equal(slug, "other");
  });

  it("prefers terra when present without env override", () => {
    const slug = resolvePreferredWorldSlug([{ slug: "alpha" }, { slug: "terra" }], {
      env: { NODE_ENV: "test" },
    });
    assert.equal(slug, "terra");
  });

  it("falls back to first world", () => {
    const slug = resolvePreferredWorldSlug([{ slug: "alpha" }, { slug: "beta" }], {
      env: { NODE_ENV: "test" },
    });
    assert.equal(slug, "alpha");
  });

  it("returns null for empty world list", () => {
    assert.equal(resolvePreferredWorldSlug([], { env: { NODE_ENV: "test" } }), null);
  });
});
