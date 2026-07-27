import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import type { PrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";
import {
  searchForAuthContext,
  searchForWikiContext,
  searchGlobalForDm,
} from "./search-service";

describe("UWE global search", () => {
  let databaseUrl: string;
  let worldId: string;
  let worldSlug: string;
  let campaignId: string;
  let dmUserId: string;
  let playerUserId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const auth = createAuthService(db);

    const world = await repo.createWorld({
      name: "Search Test World",
      slug: "search-test",
      description: "Global search tests",
    });
    worldId = world.id;
    worldSlug = world.slug;

    await auth.setWorldGuestMode(worldId, true);

    const campaign = await repo.createCampaign({
      worldId,
      name: "Hauptkampagne",
      slug: "main",
    });
    campaignId = campaign.id;

    const dm = await auth.createUser({
      displayName: "Search DM",
      email: "search-dm@uwe.local",
      password: "uwe-dev",
      role: "owner",
    });
    dmUserId = dm.id;

    await auth.createWorldMembership({
      userId: dmUserId,
      worldId,
      role: "owner",
    });

    const player = await auth.createUser({
      displayName: "Search Player",
      email: "search-player@uwe.local",
      password: "uwe-dev",
      role: "player",
    });
    playerUserId = player.id;

    await auth.createWorldMembership({
      userId: playerUserId,
      worldId,
      role: "player",
    });

    await repo.createPage({
      worldId,
      campaignId,
      title: "Öffentlicher Marktplatz",
      slug: "marktplatz",
      type: "location",
      summary: "Ein belebter Platz in der Stadt.",
      visibility: "public",
      tags: ["stadt", "markt"],
      aliases: ["Markt"],
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "public",
          content: "Händler bieten Gewürze und Stoffe an.",
        },
      ],
    });

    await repo.createPage({
      worldId,
      title: "Geheime Verschwörung",
      slug: "geheime-verschwoerung",
      type: "lore",
      summary: "Nur für den GM.",
      visibility: "dm_only",
      tags: ["geheim", "plot"],
      aliases: ["Verschwörer"],
      contentBlocks: [
        {
          type: "gm_note",
          sortOrder: 0,
          visibility: "dm_only",
          content: "Der Rat plant einen Putsch gegen den König.",
        },
      ],
    });

    await repo.createPage({
      worldId,
      title: "Die verlorene Reliquie",
      slug: "verlorene-reliquie",
      type: "quest",
      summary: "Die Gruppe muss das Artefakt finden.",
      visibility: "player_visible",
      questStatus: "open",
      tags: ["quest", "artefakt"],
      contentBlocks: [
        {
          type: "player_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: "Ein alter Magier sucht Helfer für eine gefährliche Mission.",
        },
      ],
    });

    await repo.createPage({
      worldId,
      title: "Der gefallene Turm",
      slug: "gefallener-turm",
      type: "quest",
      summary: "Diese Quest wurde bereits abgeschlossen.",
      visibility: "player_visible",
      questStatus: "completed",
      tags: ["quest"],
      contentBlocks: [
        {
          type: "player_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: "Der Turm wurde befreit.",
        },
      ],
    });

    await repo.createPage({
      worldId,
      title: "Spieler-NPC Elara",
      slug: "elara",
      type: "npc",
      summary: "Eine bekannte Magierin.",
      visibility: "player_visible",
      tags: ["magier", "verbündet"],
      aliases: ["Elara die Weise"],
      contentBlocks: [
        {
          type: "player_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: "Elara hilft der Gruppe mit Arkane Einblicke.",
        },
        {
          type: "gm_note",
          sortOrder: 1,
          visibility: "dm_only",
          content: "Elara ist eigentlich ein Doppelagent.",
        },
      ],
    });

    await repo.createPage({
      worldId,
      title: "Unveröffentlichter Entwurf",
      slug: "entwurf",
      type: "note",
      visibility: "public",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "public",
          content: "Dieser Entwurf darf nicht erscheinen.",
        },
      ],
    });

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("lets DM find all content including dm_only pages and block text", async () => {
    const db = createPrismaClient(databaseUrl);

    const byTitle = await searchForWikiContext(db, "dm", {
      query: "Verschwörung",
      worldSlug,
      urlMode: "studio",
    });
    assert.ok(byTitle.some((result) => result.slug === "geheime-verschwoerung"));

    const byTag = await searchForWikiContext(db, "dm", {
      query: "plot",
      worldSlug,
      entityFilter: "labels",
      urlMode: "studio",
    });
    assert.ok(byTag.some((result) => result.slug === "geheime-verschwoerung"));
    assert.ok(byTag[0]?.matchedFields.includes("tags"));

    const byAlias = await searchForWikiContext(db, "dm", {
      query: "Verschwörer",
      worldSlug,
      urlMode: "studio",
    });
    assert.ok(byAlias.some((result) => result.slug === "geheime-verschwoerung"));
    assert.ok(byAlias[0]?.matchedFields.includes("aliases"));

    const byContent = await searchForWikiContext(db, "dm", {
      query: "Doppelagent",
      worldSlug,
      entityFilter: "content_blocks",
      urlMode: "studio",
    });
    assert.ok(byContent.some((result) => result.slug === "elara"));
    assert.ok(byContent[0]?.matchedFields.includes("content"));

    const byNpcFilter = await searchForWikiContext(db, "dm", {
      query: "Elara",
      worldSlug,
      entityFilter: "npcs",
      urlMode: "studio",
    });
    assert.ok(byNpcFilter.some((result) => result.slug === "elara"));

    const byQuestFilter = await searchForWikiContext(db, "dm", {
      query: "Reliquie",
      worldSlug,
      entityFilter: "quests",
      urlMode: "studio",
    });
    assert.ok(byQuestFilter.some((result) => result.slug === "verlorene-reliquie"));
    assert.equal(byQuestFilter[0]?.type, "quest");
    assert.equal(byQuestFilter[0]?.questStatus, "open");

    await db.$disconnect();
  });

  it("stitches content blocks back to their own page after chunked load", async () => {
    const db = createPrismaClient(databaseUrl);

    // The search load path fetches content blocks in chunks and re-associates
    // them with their page by id. Elara's second (dm_only) block content must
    // surface only on Elara, and a different page's block must not bleed onto
    // it — guards the per-page bucketing of the chunked loader.
    const elaraBlock = await searchForWikiContext(db, "dm", {
      query: "Doppelagent",
      worldSlug,
      entityFilter: "content_blocks",
      urlMode: "studio",
    });
    assert.deepEqual(
      [...new Set(elaraBlock.map((result) => result.slug))],
      ["elara"],
      "block content must attach only to its own page",
    );

    const marktBlock = await searchForWikiContext(db, "dm", {
      query: "Gewürze",
      worldSlug,
      entityFilter: "content_blocks",
      urlMode: "studio",
    });
    assert.ok(marktBlock.some((result) => result.slug === "marktplatz"));
    assert.equal(
      marktBlock.some((result) => result.slug === "elara"),
      false,
    );

    await db.$disconnect();
  });

  it("filters quests by lifecycle status", async () => {
    const db = createPrismaClient(databaseUrl);

    const completedOnly = await searchForWikiContext(db, "dm", {
      query: "quest",
      worldSlug,
      entityFilter: "quests",
      questStatusFilter: "completed",
      urlMode: "studio",
    });
    assert.ok(completedOnly.some((result) => result.slug === "gefallener-turm"));
    assert.equal(
      completedOnly.some((result) => result.slug === "verlorene-reliquie"),
      false,
    );
    assert.ok(completedOnly.every((result) => result.questStatus === "completed"));

    const openOnly = await searchForWikiContext(db, "dm", {
      query: "quest",
      worldSlug,
      entityFilter: "quests",
      questStatusFilter: "open",
      urlMode: "studio",
    });
    assert.ok(openOnly.some((result) => result.slug === "verlorene-reliquie"));
    assert.equal(
      openOnly.some((result) => result.slug === "gefallener-turm"),
      false,
    );

    const nonQuests = await searchForWikiContext(db, "dm", {
      query: "Marktplatz",
      worldSlug,
      questStatusFilter: "open",
      urlMode: "studio",
    });
    assert.equal(nonQuests.length, 0);

    await db.$disconnect();
  });

  it("shows players only allowed content without dm_only titles or secret snippets", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(ctx);

    const results = await searchForAuthContext(db, ctx!, {
      query: "Verschwör",
      worldSlug,
      urlMode: "auth-portal",
    });
    assert.equal(
      results.some((result) => result.slug === "geheime-verschwoerung"),
      false,
    );

    const secretContent = await searchForAuthContext(db, ctx!, {
      query: "Doppelagent",
      worldSlug,
      urlMode: "auth-portal",
    });
    assert.equal(secretContent.length, 0);

    const publicResult = await searchForAuthContext(db, ctx!, {
      query: "Marktplatz",
      worldSlug,
      urlMode: "auth-portal",
    });
    assert.ok(publicResult.some((result) => result.slug === "marktplatz"));

    const playerNpc = await searchForAuthContext(db, ctx!, {
      query: "Magierin",
      worldSlug,
      urlMode: "auth-portal",
    });
    assert.ok(playerNpc.some((result) => result.slug === "elara"));
    assert.ok(playerNpc[0]?.snippet?.includes("Magierin"));

    await db.$disconnect();
  });

  it("denies anonymous guest search when guest mode is disabled", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const ctx = await auth.buildAccessContextForWorld(worldSlug);
    assert.ok(ctx);
    assert.equal(ctx.effectiveRole, "guest");
    assert.equal(ctx.guestModeEnabled, false);

    const results = await searchForAuthContext(db, ctx, {
      query: "Markt",
      worldSlug,
      urlMode: "auth-portal",
    });

    assert.deepEqual(results.map((result) => result.slug), []);

    await db.$disconnect();
  });

  it("filters portal legacy search to published public and player_visible pages", async () => {
    const db = createPrismaClient(databaseUrl);

    const results = await searchForWikiContext(db, "portal", {
      query: "Elara",
      worldSlug,
      urlMode: "portal",
    });

    const slugs = results.map((result) => result.slug);
    assert.ok(slugs.includes("elara"));
    assert.ok(!slugs.includes("geheime-verschwoerung"));
    assert.ok(!slugs.includes("entwurf"));

    await db.$disconnect();
  });

  it("supports campaign and visibility filters for DM search", async () => {
    const db = createPrismaClient(databaseUrl);

    const campaignResults = await searchForWikiContext(db, "dm", {
      query: "Markt",
      worldSlug,
      campaignId,
      urlMode: "studio",
    });
    assert.ok(campaignResults.some((result) => result.slug === "marktplatz"));
    assert.equal(campaignResults.some((result) => result.slug === "elara"), false);

    const dmOnly = await searchForWikiContext(db, "dm", {
      query: "Verschwörung",
      worldSlug,
      visibilityFilter: ["dm_only"],
      urlMode: "studio",
    });
    assert.ok(dmOnly.every((result) => result.visibility === "dm_only"));

    await db.$disconnect();
  });

  it("filters by canonical status for DM search", async () => {
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);

    const notCanon = await searchForWikiContext(db, "dm", {
      query: "Verschwörung",
      worldSlug,
      canonicalStatusFilter: "canon",
      urlMode: "studio",
    });
    assert.equal(notCanon.length, 0);

    const page = await repo.getPageBySlug(worldSlug, "geheime-verschwoerung");
    assert.ok(page);
    await repo.updatePage(page!.id, { canonicalStatus: "canon" });

    const canonOnly = await searchForWikiContext(db, "dm", {
      query: "Verschwörung",
      worldSlug,
      canonicalStatusFilter: "canon",
      urlMode: "studio",
    });
    assert.ok(canonOnly.some((result) => result.slug === "geheime-verschwoerung"));
    assert.ok(canonOnly.every((result) => result.canonicalStatus === "canon"));

    await db.$disconnect();
  });
});

describe("search index memoization", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let blockId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const repo = createUweRepository(databaseUrl);

    const world = await repo.createWorld({
      name: "Cache-Welt",
      slug: "cache-welt",
      description: "Memoization tests",
    });
    worldSlug = world.slug;

    await repo.createPage({
      worldId: world.id,
      title: "Drachenhort",
      slug: "drachenhort",
      type: "location",
      summary: "Ein Hort voller Gold.",
      visibility: "public",
      tags: ["drache"],
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "public",
          content: "Ursprünglicher Blocktext über einen Wächter.",
        },
      ],
    });

    const page = await repo.getPageBySlug(worldSlug, "drachenhort");
    assert.ok(page);
    const block = page!.contentBlocks[0];
    assert.ok(block);
    blockId = block!.id;
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("reuses loaded pages across searches and reloads after a content-block edit", async () => {
    const db = createPrismaClient(databaseUrl);

    let pageLoads = 0;
    let blockLoads = 0;
    // Count only the expensive load path (findMany). The freshness key uses
    // aggregate() and is deliberately not counted — it must run on every call.
    const spied = db.$extends({
      query: {
        page: {
          findMany({ args, query }) {
            pageLoads += 1;
            return query(args);
          },
        },
        contentBlock: {
          findMany({ args, query }) {
            blockLoads += 1;
            return query(args);
          },
        },
      },
    }) as unknown as PrismaClient;

    // Cold cache: the whole scope must be materialized once.
    const cold = await searchGlobalForDm(spied, { query: "Drachenhort", worldSlug });
    assert.ok(cold.some((result) => result.slug === "drachenhort"));
    assert.ok(pageLoads >= 1, "cold search must load pages");
    assert.ok(blockLoads >= 1, "cold search must load content blocks");

    // Warm cache, identical DB state and scope: a different query must NOT touch
    // the page/block tables — the loaded set is reused. Block text stays fully
    // searchable, proving the cached content is intact.
    pageLoads = 0;
    blockLoads = 0;
    const warm = await searchGlobalForDm(spied, { query: "Wächter", worldSlug });
    assert.equal(pageLoads, 0, "warm search must not reload pages");
    assert.equal(blockLoads, 0, "warm search must not reload content blocks");
    assert.ok(warm.some((result) => result.slug === "drachenhort"));

    // A content-block edit bumps ContentBlock.updated_at only (never the owning
    // page), yet the freshness key must still change and invalidate the cache.
    const repo = createUweRepository(databaseUrl);
    await repo.updateContentBlock(blockId, {
      content: "Neuer Blocktext über einen Zauberstab.",
    });

    pageLoads = 0;
    blockLoads = 0;
    const afterEdit = await searchGlobalForDm(spied, { query: "Zauberstab", worldSlug });
    assert.ok(pageLoads >= 1, "a block edit must invalidate the cache and reload");
    assert.ok(blockLoads >= 1, "a block edit must reload content blocks");
    assert.ok(
      afterEdit.some((result) => result.slug === "drachenhort"),
      "search must return the freshly edited block content, not a stale cache",
    );

    // The old block text must no longer match — no stale results survive.
    const staleQuery = await searchGlobalForDm(spied, {
      query: "Ursprünglicher",
      worldSlug,
    });
    assert.equal(
      staleQuery.some((result) => result.slug === "drachenhort"),
      false,
      "stale block text must be gone after invalidation",
    );

    await db.$disconnect();
  });
});
