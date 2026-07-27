import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { createGameSessionService, GameSessionService } from "./game-session";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

/** Service whose calendar sync always fails, to verify QF4 graceful handling. */
class FailingCalendarGameSessionService extends GameSessionService {
  protected override async runCalendarSync(): Promise<void> {
    throw new Error("calendar feed unavailable");
  }
}

describe("UWE game session management", () => {
  let databaseUrl: string;
  let worldId: string;
  let worldSlug: string;
  let campaignId: string;
  let npcPageId: string;
  let locationPageId: string;
  let dmUserId: string;
  let playerUserId: string;
  let sessionId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const auth = createAuthService(db);
    const sessions = createGameSessionService(databaseUrl);

    const world = await repo.createWorld({
      name: "Session Test World",
      slug: "session-test",
      description: "Game session tests",
    });
    worldId = world.id;
    worldSlug = world.slug;

    const campaign = await repo.createCampaign({
      worldId: world.id,
      name: "Main Campaign",
      slug: "main",
    });
    campaignId = campaign.id;

    const dm = await auth.createUser({
      displayName: "DM",
      email: "dm-session@test.local",
      password: "test",
      role: "dm",
    });
    dmUserId = dm.id;

    const player = await auth.createUser({
      displayName: "Player",
      email: "player-session@test.local",
      password: "test",
      role: "player",
    });
    playerUserId = player.id;

    await auth.createWorldMembership({
      userId: dm.id,
      worldId: world.id,
      role: "dm",
    });

    await auth.createWorldMembership({
      userId: player.id,
      worldId: world.id,
      role: "player",
      characterName: "Hero",
    });

    const npc = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Test NPC",
      slug: "test-npc",
      type: "npc",
    });
    npcPageId = npc.id;

    const location = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Test Location",
      slug: "test-location",
      type: "location",
    });
    locationPageId = location.id;

    const session = await sessions.create({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Session 1 — Der Anfang",
      sessionNumber: 1,
      status: "planned",
      summaryDm: "DM-only: Der Drache plant einen Angriff.",
      summaryPlayer: "Die Gruppe trifft den König.",
      notes: "DM prep notes",
      openPlots: "Drachenplot offen",
      playerDecisions: "Gruppe hilft dem König",
      linkedPageIds: [npcPageId, locationPageId],
    });
    sessionId = session.id;

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("creates a game session with linked pages", async () => {
    const sessions = createGameSessionService(databaseUrl);
    const session = await sessions.getById(sessionId);

    assert.ok(session);
    assert.equal(session.title, "Session 1 — Der Anfang");
    assert.equal(session.sessionNumber, 1);
    assert.equal(session.status, "planned");
    assert.equal(session.linkedPages.length, 2);

    const linkedIds = session.linkedPages.map((link) => link.pageId);
    assert.ok(linkedIds.includes(npcPageId));
    assert.ok(linkedIds.includes(locationPageId));
  });

  it("creates a session with a date even when calendar sync fails (QF4)", async () => {
    const db = createPrismaClient(databaseUrl);
    const failing = new FailingCalendarGameSessionService(db);
    const nextNumber = await failing.getNextSessionNumber(worldId, campaignId);

    // create() must resolve despite runCalendarSync throwing (best-effort sync).
    const session = await failing.create({
      worldId,
      campaignId,
      title: "Session mit Datum trotz Kalenderfehler",
      sessionNumber: nextNumber,
      date: new Date("2026-02-01T19:00:00.000Z"),
      status: "planned",
    });

    assert.ok(session.id, "session should be created despite calendar failure");
    const persisted = await failing.getById(session.id);
    assert.ok(persisted, "session must be persisted");
    assert.equal(persisted.title, "Session mit Datum trotz Kalenderfehler");

    await db.$disconnect();
  });

  it("links additional pages to an existing session", async () => {
    const sessions = createGameSessionService(databaseUrl);
    const repo = createUweRepository(databaseUrl);

    const dungeon = await repo.createPage({
      worldId,
      campaignId,
      title: "Test Dungeon",
      slug: "test-dungeon",
      type: "dungeon",
    });

    await sessions.linkPage(sessionId, dungeon.id);
    const updated = await sessions.getById(sessionId);
    assert.ok(updated);
    assert.equal(updated.linkedPages.length, 3);
  });

  it("player portal sees only published recaps", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(playerCtx);

    const unpublished = await auth.listGameSessionsForViewer(worldSlug, playerCtx);
    assert.equal(unpublished.length, 0);

    const unpublishedDetail = await auth.getGameSessionForViewer(worldSlug, sessionId, playerCtx);
    assert.equal(unpublishedDetail, null);

    const sessions = createGameSessionService(databaseUrl);
    await sessions.publishRecap(sessionId);

    const published = await auth.listGameSessionsForViewer(worldSlug, playerCtx);
    assert.equal(published.length, 1);
    assert.equal(published[0].title, "Session 1 — Der Anfang");
    assert.equal(published[0].summaryPlayer, "Die Gruppe trifft den König.");

    const detail = await auth.getGameSessionForViewer(worldSlug, sessionId, playerCtx);
    assert.ok(detail);
    assert.equal(detail.summaryPlayer, "Die Gruppe trifft den König.");
    assert.equal((detail as { summaryDm?: string }).summaryDm, undefined);

    await db.$disconnect();
  });

  it("DM-only notes do not leak in portal views", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const dmCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: dmUserId });
    assert.ok(dmCtx);

    const portalView = await auth.getGameSessionForViewer(worldSlug, sessionId, dmCtx);
    assert.ok(portalView);

    assert.equal((portalView as { summaryDm?: string }).summaryDm, undefined);
    assert.equal((portalView as { notes?: string }).notes, undefined);
    assert.equal(portalView.openPlots, "Drachenplot offen");
    assert.equal(portalView.playerDecisions, "Gruppe hilft dem König");
    assert.equal(portalView.summaryPlayer, "Die Gruppe trifft den König.");

    const dmView = await auth.getGameSessionForDm(worldSlug, sessionId);
    assert.ok(dmView);
    assert.equal(dmView.summaryDm, "DM-only: Der Drache plant einen Angriff.");
    assert.equal(dmView.notes, "DM prep notes");
    assert.equal(dmView.openPlots, "Drachenplot offen");
    assert.equal(dmView.playerDecisions, "Gruppe hilft dem König");

    const serialized = JSON.stringify(portalView);
    assert.ok(!serialized.includes("DM-only"));
    assert.ok(!serialized.includes("DM prep notes"));

    await db.$disconnect();
  });

  it("hides dm_only and unpublished linked page titles from players", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const repo = createUweRepository(databaseUrl);
    const sessions = createGameSessionService(databaseUrl);

    const secretPage = await repo.createPage({
      worldId,
      campaignId,
      title: "Geheimer Verräter Lord Mordrek",
      slug: "geheimer-verraeter",
      type: "npc",
      visibility: "dm_only",
    });

    const visiblePage = await repo.createPage({
      worldId,
      campaignId,
      title: "Bekannter Marktplatz",
      slug: "bekannter-marktplatz",
      type: "location",
      visibility: "player_visible",
    });

    await sessions.linkPage(sessionId, secretPage.id);
    await sessions.linkPage(sessionId, visiblePage.id);

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(playerCtx);

    const detail = await auth.getGameSessionForViewer(worldSlug, sessionId, playerCtx);
    assert.ok(detail);

    const linkedTitles = detail.linkedPages.map((page) => page.title);
    assert.ok(linkedTitles.includes("Bekannter Marktplatz"));
    assert.ok(!linkedTitles.includes("Geheimer Verräter Lord Mordrek"));

    const serialized = JSON.stringify(detail);
    assert.ok(!serialized.includes("Geheimer Verräter"));
    assert.ok(!serialized.includes("geheimer-verraeter"));

    const list = await auth.listGameSessionsForViewer(worldSlug, playerCtx);
    const serializedList = JSON.stringify(list);
    assert.ok(!serializedList.includes("Geheimer Verräter"));

    const dmView = await auth.getGameSessionForDm(worldSlug, sessionId);
    assert.ok(dmView);
    assert.ok(dmView.linkedPages.some((page) => page.title === "Geheimer Verräter Lord Mordrek"));

    await db.$disconnect();
  });
});
