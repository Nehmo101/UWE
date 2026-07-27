import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";
import { getWorldWikiGraph } from "./page-service";
import { buildPageViewForViewer } from "./page-viewer-service";
import { buildPageGraphForViewer } from "./graph-service";

/**
 * H2: buildPageViewForViewer / the neighbour graph must produce the SAME
 * backlinks + neighbours as the previous full-world-scan + regex re-parse, while
 * respecting viewer visibility exactly. Backlinks are now derived from the cached
 * parsed wikilink graph; these tests pin the expected outcome for a seeded
 * multi-page world across DM and player viewers, alias resolution, block-level
 * and page-level visibility filtering, and cache invalidation on content edits.
 */
describe("page-viewer-service backlinks + neighbour graph (H2 cache)", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let worldId: string;
  let dmUserId: string;
  let playerUserId: string;
  let focusPageId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const auth = createAuthService(db);

    const world = await repo.createWorld({
      name: "Backlink World",
      slug: "backlink-world",
    });
    worldSlug = world.slug;
    worldId = world.id;

    const dm = await auth.createUser({
      displayName: "DM",
      email: "dm-backlink@test.local",
      password: "test",
      role: "dm",
    });
    dmUserId = dm.id;

    const player = await auth.createUser({
      displayName: "Player",
      email: "player-backlink@test.local",
      password: "test",
      role: "player",
    });
    playerUserId = player.id;

    await auth.createWorldMembership({ userId: dm.id, worldId, role: "dm" });
    await auth.createWorldMembership({ userId: player.id, worldId, role: "player" });

    // Focus page every source links to. Player-visible + published so both a DM
    // and a player may read it (backlinks require the focus page to be readable).
    const focus = await repo.createPage({
      worldId,
      title: "Zielort",
      slug: "zielort",
      type: "location",
      visibility: "player_visible",
      aliases: ["Zieldorf"],
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, visibility: "player_visible", content: "Der Zielort." },
      ],
    });
    focusPageId = focus.id;

    // A: player-visible block links to the focus by title → backlink for everyone.
    await repo.createPage({
      worldId,
      title: "Quelle A",
      slug: "quelle-a",
      type: "lore",
      visibility: "player_visible",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, visibility: "player_visible", content: "Weg nach [[Zielort]]." },
      ],
    });

    // B: the ONLY link to the focus sits in a dm_only block → backlink for the DM,
    // hidden from players (block-level visibility filtering).
    await repo.createPage({
      worldId,
      title: "Quelle B",
      slug: "quelle-b",
      type: "lore",
      visibility: "player_visible",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, visibility: "player_visible", content: "Nichts zu sehen." },
        { type: "gm_note", sortOrder: 1, visibility: "dm_only", content: "Geheim: [[Zielort]]." },
      ],
    });

    // C: a dm_only PAGE links to the focus → backlink for the DM, hidden from
    // players (page-level visibility filtering).
    await repo.createPage({
      worldId,
      title: "Geheime Quelle",
      slug: "geheime-quelle",
      type: "lore",
      visibility: "dm_only",
      contentBlocks: [
        { type: "gm_note", sortOrder: 0, visibility: "dm_only", content: "Führt zu [[Zielort]]." },
      ],
    });

    // D: links via an ALIAS of the focus → backlink for everyone (alias resolution
    // must behave identically to resolveViewerLinks).
    await repo.createPage({
      worldId,
      title: "Quelle D",
      slug: "quelle-d",
      type: "lore",
      visibility: "player_visible",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, visibility: "player_visible", content: "Reise nach [[Zieldorf]]." },
      ],
    });

    // Unrelated page with no link → never a backlink.
    await repo.createPage({
      worldId,
      title: "Abseits",
      slug: "abseits",
      type: "lore",
      visibility: "player_visible",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, visibility: "player_visible", content: "Kein Bezug." },
      ],
    });

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  async function backlinkTitles(userId: string): Promise<string[]> {
    const db = createPrismaClient(databaseUrl);
    try {
      const auth = createAuthService(db);
      const repo = createUweRepository(databaseUrl);
      const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId });
      assert.ok(ctx);
      const view = await buildPageViewForViewer(auth, repo, worldSlug, "zielort", ctx!);
      assert.ok(view);
      return view!.backlinks.map((backlink) => backlink.title);
    } finally {
      await db.$disconnect();
    }
  }

  it("DM sees every source that links to the focus, incl. dm_only page + block", async () => {
    const titles = await backlinkTitles(dmUserId);
    assert.deepEqual(titles, ["Geheime Quelle", "Quelle A", "Quelle B", "Quelle D"]);
  });

  it("player sees only visible-block, visible-page backlinks (no leak)", async () => {
    const titles = await backlinkTitles(playerUserId);
    // Quelle B links only from a dm_only block; Geheime Quelle is a dm_only page.
    assert.deepEqual(titles, ["Quelle A", "Quelle D"]);
    assert.ok(!titles.includes("Quelle B"));
    assert.ok(!titles.includes("Geheime Quelle"));
  });

  it("neighbour graph for a player excludes dm_only sources", async () => {
    const db = createPrismaClient(databaseUrl);
    try {
      const auth = createAuthService(db);
      const repo = createUweRepository(databaseUrl);
      const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
      assert.ok(ctx);
      const graph = await buildPageGraphForViewer(repo, worldSlug, focusPageId, ctx!, "neighbors");

      const titles = graph.nodes.map((node) => node.title);
      assert.ok(titles.includes("Zielort"));
      assert.ok(titles.includes("Quelle A"));
      assert.ok(titles.includes("Quelle D"));
      assert.ok(!titles.includes("Geheime Quelle"));
      assert.ok(!titles.includes("Quelle B"));
      // Every edge must touch the focus and only visible nodes.
      const nodeIds = new Set(graph.nodes.map((node) => node.id));
      for (const edge of graph.edges) {
        assert.ok(nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId));
        assert.ok(edge.sourceId === focusPageId || edge.targetId === focusPageId);
      }
    } finally {
      await db.$disconnect();
    }
  });

  it("invalidates the cache when content changes (new backlink appears)", async () => {
    const repo = createUweRepository(databaseUrl);

    // Warm the cache with a DM view.
    const before = await backlinkTitles(dmUserId);
    assert.ok(!before.includes("Quelle E"));

    // The version stamp folds in block/page counts + max updatedAt, so a new page
    // (and its content block) must invalidate the previously cached graph.
    const versionBefore = await repo.getWorldGraphVersion(worldSlug);
    await repo.createPage({
      worldId,
      title: "Quelle E",
      slug: "quelle-e",
      type: "lore",
      visibility: "player_visible",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, visibility: "player_visible", content: "Neuer Pfad nach [[Zielort]]." },
      ],
    });
    const versionAfter = await repo.getWorldGraphVersion(worldSlug);
    assert.notEqual(versionAfter, versionBefore);

    const graph = await getWorldWikiGraph(repo, worldSlug);
    assert.ok(graph.pages.some((page) => page.slug === "quelle-e"));

    const after = await backlinkTitles(dmUserId);
    assert.ok(after.includes("Quelle E"), "new source must appear after content change");
    assert.equal(after.length, before.length + 1);
  });
});
