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

  it("defines player-friendly nav without admin items", () => {
    const items = portalNavItems("terra");
    assert.equal(items.some((item) => item.label.includes("Admin")), false);
    assert.equal(items.some((item) => item.label.includes("Einstellungen")), false);
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

  it("omits a separate Account sidebar section on world pages", () => {
    const sections = portalSidebar("/auth/worlds/terra/sessions", "terra");
    const titles = sections.map((section) => section.title);
    assert.equal(titles.includes("Account"), false);
    assert.equal(titles.includes("Welt"), true);
  });

  it("includes account items in the hub sidebar on account settings pages", () => {
    const sections = portalSidebar("/auth/account/security");
    const accountItems = sections.flatMap((section) => section.items).filter((item) => item.group === "Account");
    assert.ok(accountItems.some((item) => item.id === "portal-account-security" && item.active));
  });

  it("world nav items live under /auth/worlds/[slug]", () => {
    for (const item of portalWorldNav("terra").flatMap((g) => g.items)) {
      assert.ok(item.href.startsWith("/auth/worlds/terra"), `${item.id} -> ${item.href}`);
    }
  });

  it("defines world-scoped player navigation with expected destinations", () => {
    const items = portalWorldNav("terra").flatMap((group) => group.items);
    assert.equal(items.find((item) => item.id === "portal-world-wiki")?.href, "/auth/worlds/terra/wiki");
    assert.equal(items.find((item) => item.id === "portal-world-npcs")?.href, "/auth/worlds/terra/npcs");
    assert.equal(items.find((item) => item.id === "portal-world-graph")?.href, "/auth/worlds/terra/graph");
    assert.equal(items.find((item) => item.id === "portal-world-sessions")?.href, "/auth/worlds/terra/sessions");
    assert.equal(items.find((item) => item.id === "portal-world-handouts")?.href, "/auth/worlds/terra/handouts");
    assert.equal(items.find((item) => item.id === "portal-world-gallery")?.href, "/auth/worlds/terra/assets");
    assert.equal(items.find((item) => item.id === "portal-world-soundboard")?.href, "/auth/worlds/terra/soundboard");
    assert.equal(items.find((item) => item.id === "portal-world-atlas3d")?.href, "/auth/worlds/terra/atlas3d");
  });

  it("resolves active world nav from pathname", () => {
    const notesSidebar = portalSidebar("/auth/worlds/terra/notes", "terra");
    assert.ok(
      notesSidebar
        .flatMap((group) => group.items)
        .some((item) => item.id === "portal-world-notes" && item.active),
    );

    const assetsSidebar = portalSidebar("/auth/worlds/terra/assets", "terra");
    assert.ok(
      assetsSidebar
        .flatMap((group) => group.items)
        .some((item) => item.id === "portal-world-gallery" && item.active),
    );

    const handoutsSidebar = portalSidebar("/auth/worlds/terra/handouts", "terra");
    assert.ok(
      handoutsSidebar
        .flatMap((group) => group.items)
        .some((item) => item.id === "portal-world-handouts" && item.active),
    );

    const atlasSidebar = portalSidebar("/auth/worlds/terra/atlas3d", "terra");
    assert.ok(
      atlasSidebar
        .flatMap((group) => group.items)
        .some((item) => item.id === "portal-world-atlas3d" && item.active),
    );

    const wikiSidebar = portalSidebar("/auth/worlds/terra/wiki", "terra");
    assert.ok(
      wikiSidebar
        .flatMap((group) => group.items)
        .some((item) => item.id === "portal-world-wiki" && item.active),
    );

    const graphSidebar = portalSidebar("/auth/worlds/terra/graph", "terra");
    assert.ok(
      graphSidebar
        .flatMap((group) => group.items)
        .some((item) => item.id === "portal-world-graph" && item.active),
    );
  });
});
