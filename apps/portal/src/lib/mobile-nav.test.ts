import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { portalNavItems, portalWorldNav } from "../navigation/portal-nav";
import { portalAuthBottomNav, resolvePortalAuthBottomNav } from "./mobile-nav";

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
    const nav = portalAuthBottomNav("terra", "wiki");
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
    const nav = portalAuthBottomNav("terra", "quests");
    for (const item of nav) {
      if (!item.href?.startsWith("/auth/worlds/terra")) continue;
      const pathname = item.href.split("?")[0]!;
      assert.ok(worldHrefs.has(pathname), `world mobile href not in portalWorldNav: ${pathname}`);
    }
  });

  it("carries the primary thumb-zone targets inside a world (max 5 slots)", () => {
    const nav = portalAuthBottomNav("terra", "dashboard");
    assert.equal(nav.length, 5);
    assert.deepEqual(
      nav.map((item) => item.label),
      ["Start", "Wiki", "Charaktere", "Quests", "Mehr"],
    );
    assert.equal(nav.find((item) => item.label === "Wiki")?.href, "/auth/worlds/terra/wiki");
    assert.equal(
      nav.find((item) => item.label === "Charaktere")?.href,
      "/auth/worlds/terra/characters",
    );
    assert.equal(nav.find((item) => item.label === "Quests")?.href, "/auth/worlds/terra/quests");
    // Graph stays in the "Mehr" drawer, not in the thumb bar.
    assert.ok(!nav.some((item) => item.href?.endsWith("/graph")));
  });

  it("activates the dedicated tabs for dashboard, wiki, characters and quests", () => {
    const dash = resolvePortalAuthBottomNav("/auth/worlds/terra", "terra");
    assert.ok(dash.some((item) => item.label === "Start" && item.active));

    const wiki = resolvePortalAuthBottomNav("/auth/worlds/terra/wiki", "terra");
    assert.ok(wiki.some((item) => item.label === "Wiki" && item.active));

    const characters = resolvePortalAuthBottomNav("/auth/worlds/terra/characters", "terra");
    assert.ok(characters.some((item) => item.label === "Charaktere" && item.active));

    const quests = resolvePortalAuthBottomNav("/auth/worlds/terra/quests", "terra");
    assert.ok(quests.some((item) => item.label === "Quests" && item.active));
  });

  it("marks Mehr active on drawer-only routes (sessions, graph, karten)", () => {
    for (const path of [
      "/auth/worlds/terra/sessions",
      "/auth/worlds/terra/sessions/abc123",
      "/auth/worlds/terra/graph",
      "/auth/worlds/terra/karten",
      "/auth/worlds/terra/assets",
    ]) {
      const nav = resolvePortalAuthBottomNav(path, "terra");
      assert.ok(
        nav.some((item) => item.label === "Mehr" && item.active),
        `Mehr not active for ${path}`,
      );
    }
  });

  it("keeps the Wiki tab active on wiki article detail pages (catch-all slug)", () => {
    const nav = resolvePortalAuthBottomNav("/auth/worlds/terra/der-alte-turm", "terra");
    assert.ok(nav.some((item) => item.label === "Wiki" && item.active));
  });

  it("falls back to Welten/Account outside a world scope", () => {
    const account = resolvePortalAuthBottomNav("/auth/account/security", "terra");
    assert.ok(account.some((item) => item.label === "Account" && item.active));

    const hub = resolvePortalAuthBottomNav("/auth/worlds", null);
    assert.ok(hub.some((item) => item.label === "Welten" && item.active));
  });
});
