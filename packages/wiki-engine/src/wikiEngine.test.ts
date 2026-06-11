import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  createWikiStore,
  resetWikiStore,
  SEED_PAGES,
  SEED_WORLDS,
} from "@uwe/database";
import {
  getBacklinks,
  resolveWikiLinks,
  findRelatedPages,
  findBrokenLinks,
  findPlayerVisibleBrokenLinks,
  buildPlayerSafePageView,
  renderWikiContent,
  wouldLeakSecretPage,
} from "@uwe/wiki-engine";

describe("resolveWikiLinks", () => {
  beforeEach(() => {
    resetWikiStore();
  });

  it("resolves links by page title", () => {
    const store = createWikiStore();
    const page = SEED_PAGES.find((p) => p.id === "page-validori")!;
    const resolved = resolveWikiLinks(store, "world-terra", page.id, "Siehe [[Arbor]]");

    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].status, "resolved");
    assert.equal(resolved[0].targetPage?.title, "Arbor");
    assert.equal(resolved[0].href, "/worlds/terra/lore/arbor");
  });

  it("resolves links by alias", () => {
    const store = createWikiStore();
    const page = SEED_PAGES.find((p) => p.id === "page-arbor")!;
    const resolved = resolveWikiLinks(
      store,
      "world-terra",
      page.id,
      "Der Widersacher ist [[böse Fee]].",
    );

    assert.equal(resolved[0].status, "resolved");
    assert.equal(resolved[0].targetPage?.title, "Nepurga");
  });

  it("resolves alias-only wikilink targets", () => {
    const store = createWikiStore();
    const page = SEED_PAGES.find((p) => p.id === "page-nepurga")!;
    const resolved = resolveWikiLinks(
      store,
      "world-terra",
      page.id,
      "Bekannt als [[Feenkönigin]].",
    );

    assert.equal(resolved[0].status, "resolved");
    assert.equal(resolved[0].targetPage?.id, "page-nepurga");
  });

  it("marks unknown targets as broken", () => {
    const store = createWikiStore();
    const resolved = resolveWikiLinks(
      store,
      "world-terra",
      "page-arbor",
      "[[Unbekannte Stadt]]",
    );

    assert.equal(resolved[0].status, "broken");
    assert.equal(resolved[0].targetPage, undefined);
  });

  it("uses label as display text when provided", () => {
    const store = createWikiStore();
    const resolved = resolveWikiLinks(
      store,
      "world-terra",
      "page-arbor",
      "[[Nepurga|die böse Fee]]",
    );

    assert.equal(resolved[0].displayText, "die böse Fee");
    assert.equal(resolved[0].targetPage?.title, "Nepurga");
  });
});

describe("getBacklinks", () => {
  beforeEach(() => {
    resetWikiStore();
  });

  it("finds pages that link to the target", () => {
    const store = createWikiStore();
    const backlinks = getBacklinks(store, "page-nepurga");

    const titles = backlinks.map((b) => b.sourcePage.title);
    assert.ok(titles.includes("Arbor"));
    assert.ok(titles.includes("Geheime Verschwörung"));
  });

  it("does not include self-references", () => {
    const store = createWikiStore();
    const backlinks = getBacklinks(store, "page-nepurga");
    assert.ok(!backlinks.some((b) => b.sourcePage.id === "page-nepurga"));
  });

  it("filters backlinks for player portal", () => {
    const store = createWikiStore();
    const dmBacklinks = getBacklinks(store, "page-nepurga");
    const playerBacklinks = getBacklinks(store, "page-nepurga", {
      playerVisibleOnly: true,
    });

    assert.ok(dmBacklinks.length >= playerBacklinks.length);
    assert.ok(
      !playerBacklinks.some((b) => b.sourcePage.visibility === "dm_only"),
    );
  });
});

describe("findRelatedPages", () => {
  beforeEach(() => {
    resetWikiStore();
  });

  it("finds related pages via links and tags", () => {
    const store = createWikiStore();
    const related = findRelatedPages(store, "page-validori");

    assert.ok(related.length > 0);
    const titles = related.map((r) => r.page.title);
    assert.ok(titles.includes("Arbor") || titles.includes("Magister-Turm von Validori"));
  });

  it("excludes dm_only pages for player view", () => {
    const store = createWikiStore();
    const related = findRelatedPages(store, "page-magister-turm", {
      playerVisibleOnly: true,
    });

    assert.ok(!related.some((r) => r.page.title === "Geheime Verschwörung"));
  });
});

describe("findBrokenLinks", () => {
  beforeEach(() => {
    resetWikiStore();
  });

  it("reports genuinely broken links in seed data", () => {
    const store = createWikiStore();
    const broken = findBrokenLinks(store, "world-terra");

    // Magister-Turm links to [[Geheime Verschwörung]] which exists — not broken for DM
    const secretTargets = broken.filter((b) => b.target === "Geheime Verschwörung");
    assert.equal(secretTargets.length, 0);
  });

  it("detects broken links in custom content", () => {
    const store = createWikiStore();
    const pages = [...store.pages.values()];
    const testPage = pages[0];
    testPage.content += " Link zu [[Nicht Existierende Seite]].";

    const broken = findBrokenLinks(store, "world-terra");
    assert.ok(broken.some((b) => b.target === "Nicht Existierende Seite"));
  });
});

describe("player portal security", () => {
  beforeEach(() => {
    resetWikiStore();
  });

  it("treats dm_only pages as hidden for players", () => {
    const store = createWikiStore();
    const resolved = resolveWikiLinks(
      store,
      "world-terra",
      "page-magister-turm",
      "[[Geheime Verschwörung]]",
      { playerVisibleOnly: true },
    );

    assert.equal(resolved[0].status, "hidden");
    assert.equal(resolved[0].targetPage, undefined);
    assert.equal(resolved[0].displayText, "Verborgen");
  });

  it("does not leak secret page titles via alias resolution", () => {
    const store = createWikiStore();
    assert.equal(
      wouldLeakSecretPage(store, "world-terra", "Verschwörung der Magister"),
      false,
    );

    const playerResolved = resolveWikiLinks(
      store,
      "world-terra",
      "page-magister-turm",
      "[[Verschwörung der Magister]]",
      { playerVisibleOnly: true },
    );
    assert.equal(playerResolved[0].status, "hidden");
  });

  it("buildPlayerSafePageView returns null for dm_only pages", () => {
    const store = createWikiStore();
    const secret = SEED_PAGES.find((p) => p.id === "page-secret-conspiracy")!;
    const view = buildPlayerSafePageView(
      store,
      secret,
      "/worlds/terra/lore/geheime-verschwoerung",
    );
    assert.equal(view, null);
  });

  it("filters backlinks to player-visible sources only", () => {
    const store = createWikiStore();
    const nepurga = SEED_PAGES.find((p) => p.id === "page-nepurga")!;
    const view = buildPlayerSafePageView(
      store,
      nepurga,
      "/worlds/terra/npcs/nepurga",
    );

    assert.ok(view);
    assert.ok(
      view!.backlinks.every(
        (b) =>
          b.sourcePage.visibility === "player_visible" ||
          b.sourcePage.visibility === "public",
      ),
    );
  });

  it("renders dm_only targets as broken in player content", () => {
    const store = createWikiStore();
    const page = SEED_PAGES.find((p) => p.id === "page-magister-turm")!;
    const resolved = resolveWikiLinks(
      store,
      page.worldId,
      page.id,
      page.content,
      { playerVisibleOnly: true },
    );
    const html = renderWikiContent(page.content, resolved, { forPlayer: true });

    assert.ok(html.includes("wiki-link-hidden") || html.includes("Verborgen"));
    assert.ok(!html.includes("Geheime Verschwörung"));
    assert.ok(!html.includes("geheime-verschwoerung"));
  });

  it("findPlayerVisibleBrokenLinks only scans public pages", () => {
    const store = createWikiStore();
    const broken = findPlayerVisibleBrokenLinks(store, "world-terra");

    assert.ok(
      broken.every(
        (b) =>
          b.sourcePage.visibility === "player_visible" ||
          b.sourcePage.visibility === "public",
      ),
    );
  });
});

describe("world scoping", () => {
  it("does not resolve pages from other worlds", () => {
    const store = createWikiStore(
      SEED_WORLDS,
      [
        ...SEED_PAGES,
        {
          id: "page-other",
          worldId: "world-other",
          title: "Arbor",
          slug: "arbor",
          category: "lore",
          content: "",
          aliases: [],
          tags: [],
          relations: [],
          visibility: "public",
        },
      ],
    );
    store.worlds.set("world-other", {
      id: "world-other",
      slug: "other",
      name: "Other",
    });

    const resolved = resolveWikiLinks(store, "world-terra", "page-arbor", "[[Arbor]]");
    assert.equal(resolved[0].targetPage?.worldId, "world-terra");
  });
});
