import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { createPlayerNoteService } from "./player-note-service";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

describe("UWE player notes", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let campaignId: string;
  let pageId: string;
  let dmUserId: string;
  let playerUserId: string;
  let otherPlayerUserId: string;
  let privateNoteId: string;
  let submittedNoteId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const auth = createAuthService(db);
    const notes = createPlayerNoteService(databaseUrl);

    const world = await repo.createWorld({
      name: "Notes Test World",
      slug: "notes-test",
      description: "Player notes tests",
    });
    worldSlug = world.slug;

    const campaign = await repo.createCampaign({
      worldId: world.id,
      name: "Main Campaign",
      slug: "main",
    });
    campaignId = campaign.id;

    const dm = await auth.createUser({
      displayName: "DM",
      email: "dm-notes@test.local",
      password: "test",
      portalAccess: true,
      studioAccess: true,
    });
    dmUserId = dm.id;

    const player = await auth.createUser({
      displayName: "Player One",
      email: "player1-notes@test.local",
      password: "test",
      portalAccess: true,
      studioAccess: false,
    });
    playerUserId = player.id;

    const otherPlayer = await auth.createUser({
      displayName: "Player Two",
      email: "player2-notes@test.local",
      password: "test",
      portalAccess: true,
      studioAccess: false,
    });
    otherPlayerUserId = otherPlayer.id;

    await auth.createWorldMembership({ userId: dm.id, worldId: world.id });
    await auth.createWorldMembership({ userId: player.id, worldId: world.id });
    await auth.createWorldMembership({
      userId: otherPlayer.id,
      worldId: world.id,
    });

    const page = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Visible Location",
      slug: "visible-location",
      type: "location",
    });
    pageId = page.id;

    const privateNote = await notes.create({
      worldId: world.id,
      campaignId: campaign.id,
      userId: player.id,
      pageId: page.id,
      content: "Private draft about the tavern.",
      status: "draft",
      visibility: "private",
    });
    privateNoteId = privateNote.id;

    const submittedNote = await notes.create({
      worldId: world.id,
      campaignId: campaign.id,
      userId: player.id,
      pageId: page.id,
      content: "The bartender knows a secret.",
      status: "visible_to_dm",
      visibility: "dm_only",
    });
    submittedNoteId = submittedNote.id;

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("player creates a note", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(playerCtx);

    const created = await auth.createPlayerNoteForViewer(worldSlug, playerCtx, {
      campaignId,
      content: "New player observation.",
      pageId,
    });
    assert.ok(created);
    assert.equal(created.status, "draft");
    assert.equal(created.userId, playerUserId);
    assert.equal(created.content, "New player observation.");

    await db.$disconnect();
  });

  it("note with session follows the session's campaign; foreign sessions are dropped", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const repo = createUweRepository(databaseUrl);

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(playerCtx);

    // Zweite Kampagne + Session darin: die Notiz muss der Session-Kampagne
    // folgen, auch wenn das Formular eine andere Kampagne mitschickt.
    const world = await db.world.findUnique({ where: { slug: worldSlug } });
    assert.ok(world);
    const otherCampaign = await repo.createCampaign({
      worldId: world.id,
      name: "Zweite Kampagne",
      slug: "zweite",
    });
    const session = await db.gameSession.create({
      data: {
        worldId: world.id,
        campaignId: otherCampaign.id,
        title: "Session in Kampagne 2",
        sessionNumber: 1,
        status: "played",
        recapPublished: true,
      },
    });

    const created = await auth.createPlayerNoteForViewer(worldSlug, playerCtx, {
      campaignId, // absichtlich die "falsche" Kampagne
      content: "Am Tisch notiert.",
      gameSessionId: session.id,
    });
    assert.ok(created);
    assert.equal(created.gameSessionId, session.id);
    assert.equal(created.campaignId, otherCampaign.id);

    // Session einer fremden Welt: Bezug wird verworfen statt übernommen.
    const foreignWorld = await repo.createWorld({ name: "Fremd", slug: "fremd-notes" });
    const foreignSession = await db.gameSession.create({
      data: {
        worldId: foreignWorld.id,
        title: "Fremde Session",
        sessionNumber: 1,
        status: "played",
      },
    });
    const crossWorld = await auth.createPlayerNoteForViewer(worldSlug, playerCtx, {
      campaignId,
      content: "Mit fremder Session-Kennung.",
      gameSessionId: foreignSession.id,
    });
    assert.ok(crossWorld);
    assert.equal(crossWorld.gameSessionId, null);
    assert.equal(crossWorld.campaignId, campaignId);

    await db.$disconnect();
  });

  it("DM sees submitted notes in review queue", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const dmCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: dmUserId });
    assert.ok(dmCtx);

    const queue = await auth.listPlayerNoteReviewQueue(worldSlug);
    assert.ok(queue.some((note) => note.id === submittedNoteId));

    const dmNotes = await auth.listPlayerNotesForViewer(worldSlug, dmCtx, { pageId });
    assert.ok(dmNotes.some((note) => note.id === submittedNoteId));
    assert.ok(dmNotes.some((note) => note.id === privateNoteId));

    await db.$disconnect();
  });

  it("other player does not see private note", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const otherCtx = await auth.buildAccessContextForWorld(worldSlug, {
      userId: otherPlayerUserId,
    });
    assert.ok(otherCtx);

    const pageNotes = await auth.listPlayerNotesForViewer(worldSlug, otherCtx, { pageId });
    assert.ok(!pageNotes.some((note) => note.id === privateNoteId));
    assert.ok(!pageNotes.some((note) => note.id === submittedNoteId));

    const privateDetail = await auth.getPlayerNoteForViewer(worldSlug, privateNoteId, otherCtx);
    assert.equal(privateDetail, null);

    await db.$disconnect();
  });

  it("world-level list includes accepted party notes for other players", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const notes = createPlayerNoteService(databaseUrl);

    const partyNote = await notes.create({
      worldId: (await createUweRepository(databaseUrl).getWorldBySlug(worldSlug))!.id,
      campaignId,
      userId: playerUserId,
      content: "Party-visible scouting report.",
      status: "accepted",
      visibility: "party",
    });

    const otherCtx = await auth.buildAccessContextForWorld(worldSlug, {
      userId: otherPlayerUserId,
    });
    assert.ok(otherCtx);

    const worldNotes = await auth.listPlayerNotesForViewer(worldSlug, otherCtx);
    assert.ok(worldNotes.some((note) => note.id === partyNote.id));
    assert.ok(!worldNotes.some((note) => note.id === privateNoteId));
    assert.ok(!worldNotes.some((note) => note.id === submittedNoteId));

    await db.$disconnect();
  });

  it("DM can adopt a note as content block", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const notes = createPlayerNoteService(databaseUrl);

    const result = await notes.adoptAsContentBlock(submittedNoteId, pageId);
    assert.ok(result.contentBlockId);
    assert.equal(result.note.status, "accepted");
    assert.equal(result.note.visibility, "party");

    const otherCtx = await auth.buildAccessContextForWorld(worldSlug, {
      userId: otherPlayerUserId,
    });
    assert.ok(otherCtx);

    const pageNotes = await auth.listPlayerNotesForViewer(worldSlug, otherCtx, { pageId });
    assert.ok(pageNotes.some((note) => note.id === submittedNoteId));

    await db.$disconnect();
  });

  it("deleted notes do not appear in lists", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const notes = createPlayerNoteService(databaseUrl);

    await notes.softDelete(privateNoteId);

    const dmCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: dmUserId });
    assert.ok(dmCtx);

    const dmNotes = await auth.listPlayerNotesForViewer(worldSlug, dmCtx, { pageId });
    assert.ok(!dmNotes.some((note) => note.id === privateNoteId));

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(playerCtx);

    const playerNotes = await auth.listPlayerNotesForViewer(worldSlug, playerCtx, { pageId });
    assert.ok(!playerNotes.some((note) => note.id === privateNoteId));

    await db.$disconnect();
  });
});
