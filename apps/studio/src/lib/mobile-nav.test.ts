import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { studioGlobalBottomNav } from "./mobile-nav";
import { resolvePreferredWorldSlug } from "./today-dashboard";

describe("studio mobile nav", () => {
  it("uses Daily Admin OS bottom nav items", () => {
    const nav = studioGlobalBottomNav("today");
    assert.deepEqual(
      nav.map((item) => item.label),
      ["Heute", "Capture", "Suche", "KI", "Mehr"],
    );
    assert.equal(nav[0]?.active, true);
    assert.equal(nav[0]?.href, "/today");
    assert.equal(nav[1]?.href, "/capture");
    assert.equal(nav[3]?.href, "/ai");
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
