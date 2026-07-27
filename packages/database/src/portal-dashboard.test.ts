import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { createGameSessionService } from "./game-session";
import {} from "./portal-dashboard-service";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

describe("portal dashboard", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let playerUserId: string;
  let sessionId: string;
  let questPageId: string;
  let dmOnlyPageId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const auth = createAuthService(db);
    const sessions = createGameSessionService(databaseUrl);

    const world = await repo.createWorld({
      name: "Portal Dashboard World",
      slug: "portal-dash-test",
    });
    worldSlug = world.slug;

    const campaign = await repo.createCampaign({
      worldId: world.id,
      name: "Campaign",
      slug: "main",
    });

    const player = await auth.createUser({
      displayName: "Dash Player",
      email: "dash-player@test.local",
      password: "test",
      portalAccess: true,
      studioAccess: false,
    });
    playerUserId = player.id;

    await auth.createWorldMembership({
      userId: player.id,
      worldId: world.id,
      characterName: "Lyra",
    });

    const quest = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Den Turm erkunden",
      slug: "den-turm-erkunden",
      type: "quest",
    });
    questPageId = quest.id;

    const secret = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "DM Geheimnis",
      slug: "dm-geheimnis",
      type: "lore",
    });
    dmOnlyPageId = secret.id;

    const session = await sessions.create({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Session 1",
      sessionNumber: 1,
      status: "planned",
      summaryPlayer: "Die Gruppe betritt die Stadt.",
      openPlots: "Wer ist der Meisterdieb?",
      playerDecisions: "Vertrauen dem Händler",
    });
    sessionId = session.id;

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("shows only visibility-filtered dashboard content for players", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const repo = createUweRepository(databaseUrl);

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(playerCtx);

    const dashboard = await auth.getPortalDashboard(worldSlug, playerCtx);
    assert.ok(dashboard);
    assert.equal(dashboard.characterName, "Lyra");
    assert.equal(dashboard.openQuests.length, 1);
    assert.equal(dashboard.openQuests[0].id, questPageId);

    await repo.updatePage(questPageId, { questStatus: "completed" });
    const dashboardAfter = await auth.getPortalDashboard(worldSlug, playerCtx);
    assert.ok(dashboardAfter);
    assert.equal(dashboardAfter.openQuests.length, 0);

    assert.ok(!dashboard.knownNpcs.some((page) => page.id === dmOnlyPageId));

    await db.$disconnect();
  });

  it("exposes recap player fields only after publish", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const sessions = createGameSessionService(databaseUrl);

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(playerCtx);

    assert.equal(await auth.getGameSessionForViewer(worldSlug, sessionId, playerCtx), null);

    await sessions.publishRecap(sessionId);

    const detail = await auth.getGameSessionForViewer(worldSlug, sessionId, playerCtx);
    assert.ok(detail);
    assert.equal(detail.summaryPlayer, "Die Gruppe betritt die Stadt.");
    assert.equal(detail.openPlots, "Wer ist der Meisterdieb?");
    assert.equal(detail.playerDecisions, "Vertrauen dem Händler");
    assert.equal((detail as { summaryDm?: string }).summaryDm, undefined);

    await db.$disconnect();
  });

  it("shows nextSession when playerVisibleSchedule is enabled without recap", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const sessions = createGameSessionService(databaseUrl);
    const repo = createUweRepository(databaseUrl);

    const world = await repo.getWorldBySlug(worldSlug);
    assert.ok(world);
    const campaign = (await repo.listCampaignsByWorld(worldSlug))[0];
    assert.ok(campaign);

    const upcoming = await sessions.create({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Session 3 Ankündigung",
      sessionNumber: 3,
      status: "planned",
      summaryPlayer: "Geheime Prep — darf nicht leaken",
      playerVisibleSchedule: true,
    });

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(playerCtx);

    const dashboard = await auth.getPortalDashboard(worldSlug, playerCtx);
    assert.ok(dashboard);
    assert.ok(dashboard.nextSession);
    assert.equal(dashboard.nextSession.id, upcoming.id);
    assert.equal(dashboard.nextSession.title, "Session 3 Ankündigung");

    const detail = await auth.getGameSessionForViewer(worldSlug, upcoming.id, playerCtx);
    assert.ok(detail);
    assert.equal(detail.summaryPlayer, null);
    assert.equal(detail.openPlots, null);

    await db.$disconnect();
  });

  it("picks the next future announced session and skips stale past announcements", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const sessions = createGameSessionService(databaseUrl);
    const repo = createUweRepository(databaseUrl);

    const world = await repo.getWorldBySlug(worldSlug);
    assert.ok(world);
    const campaign = (await repo.listCampaignsByWorld(worldSlug))[0];
    assert.ok(campaign);

    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const stale = await sessions.create({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Verwaiste Ankündigung",
      sessionNumber: 4,
      status: "planned",
      date: pastDate,
      playerVisibleSchedule: true,
    });

    const announced = await sessions.create({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Session 5 Ankündigung",
      sessionNumber: 5,
      status: "planned",
      date: futureDate,
      summaryPlayer: "Geheime Prep — darf nicht leaken",
      playerVisibleSchedule: true,
    });

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(playerCtx);

    const dashboard = await auth.getPortalDashboard(worldSlug, playerCtx);
    assert.ok(dashboard);
    assert.ok(dashboard.nextSession);
    // Dated upcoming announcement wins over the undated one; the stale
    // past-dated announcement never becomes "next".
    assert.equal(dashboard.nextSession.id, announced.id);
    assert.notEqual(dashboard.nextSession.id, stale.id);
    assert.equal(dashboard.nextSession.date?.getTime(), futureDate.getTime());
    // Announced without a published recap → recap fields stay hidden.
    assert.equal(dashboard.nextSession.summaryPlayer, null);

    await db.$disconnect();
  });

});
