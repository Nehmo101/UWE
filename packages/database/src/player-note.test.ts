import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { createPlayerNoteService } from "./player-note-service";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

describe("UWE player notes", () => {
  let databaseUrl: string;
  let worldId: string;
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
      email: "dm-notes@test.local",
      password: "test",
      role: "dm",
    });
    dmUserId = dm.id;

    const player = await auth.createUser({
      displayName: "Player One",
      email: "player1-notes@test.local",
      password: "test",
      role: "player",
    });
    playerUserId = player.id;

    const otherPlayer = await auth.createUser({
      displayName: "Player Two",
      email: "player2-notes@test.local",
      password: "test",
      role: "player",
    });
    otherPlayerUserId = otherPlayer.id;

    await auth.createWorldMembership({ userId: dm.id, worldId: world.id, role: "dm" });
    await auth.createWorldMembership({ userId: player.id, worldId: world.id, role: "player" });
    await auth.createWorldMembership({
      userId: otherPlayer.id,
      worldId: world.id,
      role: "player",
    });

    const page = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Visible Location",
      slug: "visible-location",
      type: "location",
      visibility: "player_visible",
      publishStatus: "published",
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
