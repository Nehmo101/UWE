import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { studioGlobalBottomNav, studioWorldBottomNav } from "./mobile-nav";
import { resolvePreferredWorldSlug } from "./today-dashboard";

describe("studio mobile nav", () => {
  it("uses consolidated IA bottom nav items", () => {
    const nav = studioGlobalBottomNav("today");
    assert.deepEqual(
      nav.map((item) => item.label),
      ["Heute", "Leben", "Welten", "KI", "Mehr"],
    );
    assert.equal(nav[0]?.active, true);
    assert.equal(nav[0]?.href, "/today");
    assert.equal(nav[1]?.href, "/capture");
    assert.equal(nav[2]?.href, "/worlds");
    assert.equal(nav[3]?.href, "/ai");
  });

  it("uses world-scoped bottom nav with sidebar fallback", () => {
    const nav = studioWorldBottomNav("terra", "more");
    assert.deepEqual(
      nav.map((item) => item.label),
      ["Übersicht", "Seiten", "Suche", "Inspektor", "Mehr"],
    );
    assert.equal(nav[0]?.href, "/worlds/terra/dashboard");
    assert.equal(nav[1]?.href, "/worlds/terra");
    assert.equal(nav[2]?.href, "/worlds/terra?q=");
    assert.equal(nav[3]?.href, "/worlds/terra/inspector");
    assert.equal(nav[4]?.action, "open-sidebar");
  });

  it("highlights active world bottom nav tab", () => {
    const pagesNav = studioWorldBottomNav("terra", "pages");
    assert.equal(pagesNav[1]?.active, true);
    const inspectorNav = studioWorldBottomNav("terra", "inspector");
    assert.equal(inspectorNav[3]?.active, true);
    const moreNav = studioWorldBottomNav("terra", "more");
    assert.equal(moreNav[4]?.active, true);
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
