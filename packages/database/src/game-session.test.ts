import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { createGameSessionService } from "./game-session";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

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
    assert.equal((portalView as { openPlots?: string }).openPlots, undefined);
    assert.equal((portalView as { playerDecisions?: string }).playerDecisions, undefined);

    const dmView = await auth.getGameSessionForDm(worldSlug, sessionId);
    assert.ok(dmView);
    assert.equal(dmView.summaryDm, "DM-only: Der Drache plant einen Angriff.");
    assert.equal(dmView.notes, "DM prep notes");
    assert.equal(dmView.openPlots, "Drachenplot offen");
    assert.equal(dmView.playerDecisions, "Gruppe hilft dem König");

    const serialized = JSON.stringify(portalView);
    assert.ok(!serialized.includes("DM-only"));
    assert.ok(!serialized.includes("DM prep notes"));
    assert.ok(!serialized.includes("Drachenplot offen"));

    await db.$disconnect();
  });
});
