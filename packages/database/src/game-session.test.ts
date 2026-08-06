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

/** Service that records calendar unsyncs instead of touching the family DB. */
class TrackingUnsyncGameSessionService extends GameSessionService {
  public unsyncedIds: string[] = [];
  protected override async runCalendarUnsync(sessionId: string): Promise<void> {
    this.unsyncedIds.push(sessionId);
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
      portalAccess: true,
      studioAccess: true,
    });
    dmUserId = dm.id;

    const player = await auth.createUser({
      displayName: "Player",
      email: "player-session@test.local",
      password: "test",
      portalAccess: true,
      studioAccess: false,
    });
    playerUserId = player.id;

    await auth.createWorldMembership({
      userId: dm.id,
      worldId: world.id,
    });

    await auth.createWorldMembership({
      userId: player.id,
      worldId: world.id,
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

  it("removes a session including live protocol, links and availabilities", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = new TrackingUnsyncGameSessionService(db);

    const session = await service.create({
      worldId,
      campaignId,
      title: "Wegwerf-Session",
      sessionNumber: 99,
      status: "played",
      linkedPageIds: [npcPageId],
    });

    await db.sessionLiveEntry.create({
      data: { gameSessionId: session.id, kind: "note", content: "Am Tisch notiert" },
    });
    await db.sessionAvailability.create({
      data: { sessionId: session.id, userId: playerUserId, status: "yes" },
    });

    // Tenant-Guard: falscher Welt-Slug löscht nichts.
    assert.equal(await service.remove("andere-welt", session.id), null);
    assert.ok(await service.getById(session.id));

    const removed = await service.remove(worldSlug, session.id);
    assert.ok(removed);
    assert.equal(removed.title, "Wegwerf-Session");
    assert.deepEqual(service.unsyncedIds, [session.id]);

    assert.equal(await service.getById(session.id), null);
    assert.equal(
      await db.sessionLiveEntry.count({ where: { gameSessionId: session.id } }),
      0,
    );
    assert.equal(
      await db.sessionAvailability.count({ where: { sessionId: session.id } }),
      0,
    );
    // Die verknüpfte Seite selbst bleibt bestehen.
    assert.ok(await db.page.findUnique({ where: { id: npcPageId } }));

    await db.$disconnect();
  });

  it("links a session to a story arc chapter and guards the world boundary", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createGameSessionService(databaseUrl);
    const repo = createUweRepository(databaseUrl);

    const chapter = await repo.createPage({
      worldId,
      campaignId,
      title: "Akt I",
      slug: "akt-i",
      type: "story_arc",
    });

    const nextNumber = await service.getNextSessionNumber(worldId, campaignId);
    const session = await service.create({
      worldId,
      campaignId,
      title: "Kapitel-Session",
      sessionNumber: nextNumber,
      storyArcPageId: chapter.id,
    });
    assert.equal(session.storyArcPageId, chapter.id);
    assert.equal(session.storyArcPage?.title, "Akt I");

    // Keine story_arc-Seite → abgelehnt (Tenant-/Typ-Guard).
    await assert.rejects(
      service.update(session.id, { storyArcPageId: npcPageId }),
      /Kapitel nicht gefunden/,
    );

    // Kapitel löschen → Session bleibt, Bezug fällt auf null (SetNull).
    await db.page.delete({ where: { id: chapter.id } });
    const after = await service.getById(session.id);
    assert.ok(after);
    assert.equal(after.storyArcPageId, null);

    await db.$disconnect();
  });

  /**
   * Tischrunden-Sicht: der Befund war, dass Spieler die Abende *aller* Runden
   * derselben Welt sahen. Die Welt-Zuordnung sagt, WAS lesbar ist — die
   * Spielergruppe aus dem Studio sagt, an welchem Tisch jemand sitzt, und ist
   * für Sessions ab hier führend.
   */
  describe("Sessions je Tischrunde", () => {
    let groupAId: string;
    let groupBId: string;
    let playerAId: string;
    let playerBId: string;
    let sessionAId: string;
    let sessionBId: string;
    let worldWideSessionId: string;

    before(async () => {
      const db = createPrismaClient(databaseUrl);
      const auth = createAuthService(db);
      const service = createGameSessionService(databaseUrl);

      const playerA = await auth.createUser({
        displayName: "Spielerin A",
        email: "gruppe-a@test.local",
        password: "test",
        portalAccess: true,
        studioAccess: false,
      });
      playerAId = playerA.id;
      const playerB = await auth.createUser({
        displayName: "Spieler B",
        email: "gruppe-b@test.local",
        password: "test",
        portalAccess: true,
        studioAccess: false,
      });
      playerBId = playerB.id;

      for (const userId of [playerAId, playerBId]) {
        await auth.createWorldMembership({ userId, worldId });
      }

      // Gruppen direkt über Prisma: `@uwe/player-hub` hängt an diesem Paket,
      // nicht umgekehrt — der Service ist hier nicht importierbar.
      const groupA = await db.playerGroup.create({
        data: { worldId, name: "Dienstagsrunde", slug: "dienstagsrunde" },
      });
      groupAId = groupA.id;
      const groupB = await db.playerGroup.create({
        data: { worldId, name: "Freitagsrunde", slug: "freitagsrunde" },
      });
      groupBId = groupB.id;

      await db.playerGroupMember.create({ data: { groupId: groupAId, userId: playerAId } });
      await db.playerGroupMember.create({ data: { groupId: groupBId, userId: playerBId } });

      const sessionA = await service.create({
        worldId,
        campaignId,
        groupId: groupAId,
        title: "Abend der Dienstagsrunde",
        sessionNumber: await service.getNextSessionNumber(worldId, campaignId),
      });
      sessionAId = sessionA.id;
      const sessionB = await service.create({
        worldId,
        campaignId,
        groupId: groupBId,
        title: "Abend der Freitagsrunde",
        sessionNumber: (await service.getNextSessionNumber(worldId, campaignId)) + 1,
      });
      sessionBId = sessionB.id;
      const worldWide = await service.create({
        worldId,
        campaignId,
        title: "Welt-weiter Abend",
        sessionNumber: (await service.getNextSessionNumber(worldId, campaignId)) + 2,
      });
      worldWideSessionId = worldWide.id;

      for (const id of [sessionAId, sessionBId, worldWideSessionId]) {
        await service.publishRecap(id);
      }

      await db.$disconnect();
    });

    async function visibleSessionIds(userId: string | null): Promise<Set<string>> {
      const db = createPrismaClient(databaseUrl);
      const auth = createAuthService(db);
      const ctx = await auth.buildAccessContextForWorld(worldSlug, {
        userId: userId ?? undefined,
      });
      assert.ok(ctx);
      const sessions = await auth.listGameSessionsForViewer(worldSlug, ctx);
      await db.$disconnect();
      return new Set(sessions.map((session) => session.id));
    }

    it("zeigt jeder Runde nur ihre eigenen Abende — plus die welt-weiten", async () => {
      const forA = await visibleSessionIds(playerAId);
      assert.ok(forA.has(sessionAId), "eigene Runde fehlt");
      assert.ok(forA.has(worldWideSessionId), "welt-weiter Abend fehlt");
      assert.ok(!forA.has(sessionBId), "fremde Runde ist sichtbar");

      const forB = await visibleSessionIds(playerBId);
      assert.ok(forB.has(sessionBId));
      assert.ok(forB.has(worldWideSessionId));
      assert.ok(!forB.has(sessionAId));
    });

    it("zeigt einem Spieler ohne Tischrunde keine Gruppen-Abende", async () => {
      // `playerUserId` sitzt in keiner Gruppe — fail-closed: nur welt-weit.
      const visible = await visibleSessionIds(playerUserId);
      assert.ok(visible.has(worldWideSessionId));
      assert.ok(!visible.has(sessionAId));
      assert.ok(!visible.has(sessionBId));
    });

    it("öffnet die Detailseite einer fremden Runde auch mit bekannter Id nicht", async () => {
      const db = createPrismaClient(databaseUrl);
      const auth = createAuthService(db);

      const ctxA = await auth.buildAccessContextForWorld(worldSlug, { userId: playerAId });
      assert.ok(ctxA);
      assert.equal(await auth.getGameSessionForViewer(worldSlug, sessionBId, ctxA), null);
      assert.ok(await auth.getGameSessionForViewer(worldSlug, sessionAId, ctxA));
      assert.ok(await auth.getGameSessionForViewer(worldSlug, worldWideSessionId, ctxA));

      // Der Spielleiter sieht die Portal-Sicht weiterhin vollständig.
      const dmCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: dmUserId });
      assert.ok(dmCtx);
      assert.ok(await auth.getGameSessionForViewer(worldSlug, sessionBId, dmCtx));

      await db.$disconnect();
    });

    it("hängt eine Spielernotiz nicht an den Abend einer fremden Runde", async () => {
      const db = createPrismaClient(databaseUrl);
      const auth = createAuthService(db);

      const ctxA = await auth.buildAccessContextForWorld(worldSlug, { userId: playerAId });
      assert.ok(ctxA);

      const note = await auth.createPlayerNoteForViewer(worldSlug, ctxA, {
        campaignId,
        content: "Versuch, an einem fremden Abend zu hängen",
        gameSessionId: sessionBId,
      });
      assert.ok(note);
      assert.equal(note.gameSessionId, null);

      const ownNote = await auth.createPlayerNoteForViewer(worldSlug, ctxA, {
        campaignId,
        content: "Notiz zum eigenen Abend",
        gameSessionId: sessionAId,
      });
      assert.ok(ownNote);
      assert.equal(ownNote.gameSessionId, sessionAId);

      await db.$disconnect();
    });

    it("lehnt eine Runde aus einer fremden Welt ab", async () => {
      const service = createGameSessionService(databaseUrl);
      const repo = createUweRepository(databaseUrl);

      const otherWorld = await repo.createWorld({
        name: "Fremde Welt",
        slug: "fremde-welt-sessions",
      });
      const db = createPrismaClient(databaseUrl);
      const foreignGroup = await db.playerGroup.create({
        data: { worldId: otherWorld.id, name: "Fremde Runde", slug: "fremde-runde" },
      });

      await assert.rejects(
        service.update(sessionAId, { groupId: foreignGroup.id }),
        /Tischrunde nicht gefunden/,
      );

      await db.$disconnect();
    });

    it("löst sich die Runde auf, wird der Abend wieder welt-weit (SetNull)", async () => {
      const db = createPrismaClient(databaseUrl);
      const service = createGameSessionService(databaseUrl);

      await db.playerGroup.delete({ where: { id: groupBId } });

      const session = await service.getById(sessionBId);
      assert.ok(session);
      assert.equal(session.groupId, null);

      // Ab jetzt sieht ihn auch die andere Runde — genau wie jeden anderen
      // Abend ohne Zuordnung.
      const visible = await visibleSessionIds(playerAId);
      assert.ok(visible.has(sessionBId));

      await db.$disconnect();
    });
  });
});
