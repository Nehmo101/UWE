import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { createGameSessionService } from "./game-session";
import { createPortalDashboardService } from "./portal-dashboard-service";
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
      role: "player",
    });
    playerUserId = player.id;

    await auth.createWorldMembership({
      userId: player.id,
      worldId: world.id,
      role: "player",
      characterName: "Lyra",
    });

    const quest = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Den Turm erkunden",
      slug: "den-turm-erkunden",
      type: "quest",
      visibility: "player_visible",
      publishStatus: "published",
    });
    questPageId = quest.id;

    const secret = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "DM Geheimnis",
      slug: "dm-geheimnis",
      type: "lore",
      visibility: "dm_only",
      publishStatus: "published",
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

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(playerCtx);

    const dashboard = await auth.getPortalDashboard(worldSlug, playerCtx);
    assert.ok(dashboard);
    assert.equal(dashboard.characterName, "Lyra");
    assert.equal(dashboard.openQuests.length, 1);
    assert.equal(dashboard.openQuests[0].id, questPageId);
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

  it("auto-unlocks linked unlock_after_session pages when recap is published", async () => {
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const auth = createAuthService(db);
    const sessions = createGameSessionService(databaseUrl);

    const world = await repo.getWorldBySlug(worldSlug);
    assert.ok(world);
    const campaign = (await repo.listCampaignsByWorld(worldSlug))[0];
    assert.ok(campaign);

    const locked = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Nach Session 2",
      slug: "nach-session-2",
      type: "note",
      visibility: "unlock_after_session",
      publishStatus: "published",
    });

    const session2 = await sessions.create({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Session 2",
      sessionNumber: 2,
      status: "played",
      summaryPlayer: "Boss besiegt",
      linkedPageIds: [locked.id],
    });

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(playerCtx);

    const before = await auth.listPagesForViewer(worldSlug, playerCtx);
    assert.ok(!before.some((page) => page.id === locked.id));

    await sessions.publishRecap(session2.id);

    const after = await auth.listPagesForViewer(worldSlug, playerCtx);
    assert.ok(after.some((page) => page.id === locked.id));

    const dashboard = createPortalDashboardService(db);
    const unlocked = await dashboard.listNewlyUnlockedPagesForSession(
      worldSlug,
      playerCtx,
      2,
      "Session 2: Session 2",
    );
    assert.ok(unlocked.some((page) => page.id === locked.id));

    await db.$disconnect();
  });
});
