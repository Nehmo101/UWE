import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { hashOpaqueToken } from "@uwe/auth/server";
import { createAuthService } from "./auth";
import { seedAuthDemoContent, seedAuthUsers } from "./auth-seed";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";
import { createWorldEventService } from "./world-event-service";

describe("UWE auth and permissions", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let dmUserId: string;
  let amanUserId: string;
  let lazulUserId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const auth = createAuthService(db);

    const world = await repo.createWorld({
      name: "Auth Test World",
      slug: "auth-test",
      description: "Auth integration tests",
    });
    worldSlug = world.slug;


    const users = await seedAuthUsers(auth, repo, world.id);
    dmUserId = users.dm.id;
    amanUserId = users.players.find((player) => player.displayName === "Aman")!.id;
    lazulUserId = users.players.find((player) => player.displayName === "Lazul")!.id;

    await seedAuthDemoContent(auth, repo, world.id, {
      aman: amanUserId,
      lazul: lazulUserId,
      veldrin: users.players.find((player) => player.displayName === "Veldrin")!.id,
      finnion: users.players.find((player) => player.displayName === "Finnion")!.id,
    });

    await repo.createPage({
      worldId: world.id,
      title: "Public Notice",
      slug: "public-notice",
      type: "note",
      portalReleased: true,
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          content: "Public bulletin.",
        },
      ],
    });

    await repo.createPage({
      worldId: world.id,
      title: "Player Lore",
      slug: "player-lore",
      type: "note",
      portalReleased: true,
      contentBlocks: [
        {
          type: "player_text",
          sortOrder: 0,
          content: "Known to the party.",
        },
        {
          type: "rich_text",
          sortOrder: 1,
          content: "Hidden GM note.",
        },
      ],
    });

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("lets DM see all pages including archived and dm_only blocks", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId: dmUserId });
    assert.ok(ctx);
    assert.equal(ctx.user?.access.studio, true);

    const pages = await auth.listPagesForViewer(worldSlug, ctx);
    const slugs = pages.map((page) => page.slug);

    assert.ok(slugs.includes("public-notice"));
    assert.ok(slugs.includes("player-lore"));
    assert.ok(slugs.includes("archivierte-notiz"));
    assert.ok(slugs.includes("amans-geheimnis"));

    const playerLore = await auth.getPageForViewer(worldSlug, "player-lore", ctx);
    assert.ok(playerLore);
    assert.equal(playerLore.contentBlocks.length, 2);

    await db.$disconnect();
  });

  it("shows an assigned player every page of the world", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId: amanUserId });
    assert.ok(ctx);
    assert.equal(ctx.user?.access.studio, false);
    assert.ok(ctx.worldMembership);

    const pages = await auth.listPagesForViewer(worldSlug, ctx);
    const slugs = pages.map((page) => page.slug);

    assert.ok(slugs.includes("public-notice"));
    assert.ok(slugs.includes("player-lore"));
    assert.ok(slugs.includes("amans-geheimnis"));
    assert.ok(slugs.includes("archivierte-notiz"));

    const playerLore = await auth.getPageForViewer(worldSlug, "player-lore", ctx);
    assert.ok(playerLore);
    assert.ok(playerLore.contentBlocks.length >= 1);

    await db.$disconnect();
  });

  it("denies anonymous viewers — there is no guest mode left", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const ctx = await auth.buildAccessContextForWorld(worldSlug);
    assert.ok(ctx);
    assert.equal(ctx.user, null);
    assert.equal(ctx.worldMembership, null);

    const pages = await auth.listPagesForViewer(worldSlug, ctx);
    assert.deepEqual(
      pages.map((page) => page.slug),
      [],
    );

    await db.$disconnect();
  });

  it("supports preview-as-player for DM users", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const previewCtx = await auth.buildAccessContextForWorld(worldSlug, {
      userId: dmUserId,
      preview: { previewAsUserId: amanUserId },
    });

    assert.ok(previewCtx);
    assert.equal(previewCtx.previewAsUserId, amanUserId);

    const pages = await auth.listPagesForViewer(worldSlug, previewCtx);
    const slugs = pages.map((page) => page.slug);

    assert.ok(slugs.includes("amans-geheimnis"));
    assert.ok(slugs.includes("archivierte-notiz"));

    const previewBlocks = await auth.getPageForViewer(worldSlug, "player-lore", previewCtx);
    assert.ok(previewBlocks);
    assert.ok(previewBlocks.contentBlocks.length >= 1);

    await db.$disconnect();
  });

  it("creates and validates login sessions", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const user = await auth.authenticate("aman@uwe.local", "uwe-dev");
    assert.ok(user);
    assert.equal(user.displayName, "Aman");

    const session = await auth.createSession(user.id);
    const loaded = await auth.getSessionByToken(session.token);
    assert.ok(loaded);
    assert.equal(loaded.user.id, user.id);

    const stored = await db.session.findUnique({ where: { id: session.id } });
    assert.ok(stored);
    assert.equal(stored.tokenHash, hashOpaqueToken(session.token));

    await auth.deleteSession(session.token);
    assert.equal(await auth.getSessionByToken(session.token), null);

    await db.$disconnect();
  });

  it("expires sessions after configured inactivity timeout", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const user = await auth.authenticate("aman@uwe.local", "uwe-dev");
    assert.ok(user);

    const session = await auth.createSession(user.id);
    await db.systemSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        settings: {
          auth: { sessionInactivityTimeoutMinutes: 5 },
        },
      },
      update: {
        settings: {
          auth: { sessionInactivityTimeoutMinutes: 5 },
        },
      },
    });

    await db.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date(Date.now() - 6 * 60 * 1000) },
    });

    assert.equal(await auth.getSessionByToken(session.token), null);

    await db.$disconnect();
  });

  it("touchSession keeps an active session valid", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const user = await auth.authenticate("aman@uwe.local", "uwe-dev");
    assert.ok(user);

    const session = await auth.createSession(user.id);
    await db.systemSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        settings: {
          auth: { sessionInactivityTimeoutMinutes: 5 },
        },
      },
      update: {
        settings: {
          auth: { sessionInactivityTimeoutMinutes: 5 },
        },
      },
    });

    assert.equal(await auth.touchSession(session.token), true);
    assert.ok(await auth.getSessionByToken(session.token));

    await db.$disconnect();
  });

  it("shows handouts, npcs and timeline events to assigned players", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const repo = createUweRepository(databaseUrl);
    const world = await repo.getWorldBySlug(worldSlug);
    assert.ok(world);

    await repo.createPage({
      worldId: world.id,
      title: "Geheimer NPC",
      slug: "geheimer-npc",
      type: "npc",
      portalReleased: true,
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          content: "Nur für den GM.",
        },
      ],
    });

    await repo.createPage({
      worldId: world.id,
      title: "Geheimes Handout",
      slug: "geheimes-handout",
      type: "handout",
      portalReleased: true,
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          content: "Nur für den GM.",
        },
      ],
    });

    const events = createWorldEventService(db);
    await events.create({
      worldId: world.id,
      inGameDate: { year: 1, month: 1, day: 1 },
      title: "GM Geheimnis",
      summaryPlayer: "Nur GM",
    });

    const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId: amanUserId });
    assert.ok(ctx);

    const pages = await auth.listPagesForViewer(worldSlug, ctx);
    const slugs = pages.map((page) => page.slug);
    assert.ok(slugs.includes("geheimer-npc"));
    assert.ok(slugs.includes("geheimes-handout"));

    const timeline = await auth.listWorldEventsForViewer(worldSlug, ctx);
    assert.ok(timeline.some((event) => event.title === "GM Geheimnis"));

    await db.$disconnect();
  });
});
