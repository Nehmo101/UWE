import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  portalGlobalNav,
  portalWorldNav,
  resolvePortalWorldNavKey,
} from "./portal-navigation";

describe("portal navigation", () => {
  it("defines player-friendly global nav without admin items", () => {
    const nav = portalGlobalNav("worlds");
    const labels = nav.map((item) => item.label);
    assert.deepEqual(labels, ["Start", "Meine Welten", "Welt entdecken", "Account", "Hilfe"]);
    assert.equal(nav.find((item) => item.key === "worlds")?.active, true);
    assert.equal(nav.some((item) => item.label.includes("Admin")), false);
  });

  it("defines world-scoped player navigation", () => {
    const nav = portalWorldNav("terra", "sessions");
    assert.equal(nav.find((item) => item.key === "sessions")?.active, true);
    assert.equal(nav.find((item) => item.key === "handouts")?.href, "/auth/worlds/terra/assets");
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
  });
});
