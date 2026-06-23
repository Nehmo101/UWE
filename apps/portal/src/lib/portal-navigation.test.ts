import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  portalAuthSidebarSections,
  portalGlobalNav,
  portalPublicNav,
  portalWorldNav,
  resolvePortalWorldNavKey,
} from "./portal-navigation";

describe("portal navigation", () => {
  it("defines player-friendly global nav without admin items", () => {
    const nav = portalGlobalNav("worlds");
    const labels = nav.map((item) => item.label);
    assert.deepEqual(labels, ["Start", "Meine Welten", "Welt entdecken", "Account"]);
    assert.equal(nav.find((item) => item.key === "worlds")?.active, true);
    assert.equal(nav.some((item) => item.label.includes("Admin")), false);
    assert.equal(nav.some((item) => item.label.includes("Einstellungen")), false);
  });

  it("defines public wiki navigation without admin items", () => {
    const nav = portalPublicNav("discover");
    const labels = nav.map((item) => item.label);
    assert.deepEqual(labels, ["Welten entdecken", "Meine Welten", "Anmelden"]);
    assert.equal(nav.find((item) => item.key === "discover")?.active, true);
  });

  it("omits account sidebar on world pages", () => {
    const sections = portalAuthSidebarSections({
      worldSlug: "terra",
      worldActive: "sessions",
    });
    assert.equal(sections.some((section) => section.title === "Account"), false);
    assert.equal(sections.some((section) => section.title === "Welt"), true);
  });

  it("includes account sidebar on account settings pages", () => {
    const sections = portalAuthSidebarSections({
      accountActive: "security",
      includeAccount: true,
    });
    assert.equal(sections.some((section) => section.title === "Account"), true);
  });

  it("defines world-scoped player navigation", () => {
    const nav = portalWorldNav("terra", "sessions");
    assert.equal(nav.find((item) => item.key === "sessions")?.active, true);
    assert.equal(nav.find((item) => item.key === "handouts")?.href, "/auth/worlds/terra/assets");
    assert.equal(nav.find((item) => item.key === "soundboard")?.href, "/auth/worlds/terra/soundboard");
  });

  it("resolves active world nav from pathname", () => {
    assert.equal(
      resolvePortalWorldNavKey("/auth/worlds/terra/notes", "terra"),
      "notes",
    );
    assert.equal(
      resolvePortalWorldNavKey("/auth/worlds/terra/assets", "terra"),
      "handouts",
    );
    assert.equal(
      resolvePortalWorldNavKey("/auth/worlds/terra/soundboard", "terra"),
      "soundboard",
    );
  });
});
