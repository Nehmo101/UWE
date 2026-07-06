import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";
import { searchForAuthContext, searchForWikiContext } from "./search-service";

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
      publishStatus: "published",
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
      publishStatus: "published",
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
      publishStatus: "published",
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
      publishStatus: "published",
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
      publishStatus: "published",
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
      publishStatus: "draft",
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
