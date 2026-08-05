import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "@uwe/database/client";
import { createUweRepository } from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { createCampaignCockpitService } from "./cockpit-service";
import { createStoryArcPinService } from "./act-board";
import { createSessionWrapUpService } from "./wrap-up-service";

describe("campaign cockpit (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;
  let worldId: string;
  let campaignId: string;
  const worldSlug = "cockpit-test";

  before(async () => {
    const url = createTestDatabaseUrl();
    db = createPrismaClient(url);
    const world = await createUweRepository(url).createWorld({
      name: "Cockpit",
      slug: worldSlug,
    });
    worldId = world.id;
    const campaign = await db.campaign.create({
      data: { worldId, name: "Himmelsrouten", slug: "himmelsrouten" },
    });
    campaignId = campaign.id;
  });

  after(async () => {
    await db.$disconnect();
  });

  it("creates chapters with generated slug and increasing sortIndex", async () => {
    const service = createCampaignCockpitService(db);
    const first = await service.createChapter({ worldId, campaignId, title: "Aufbruch" });
    const second = await service.createChapter({ worldId, campaignId, title: "Aufbruch" });
    assert.equal(first.slug, "aufbruch");
    assert.notEqual(second.slug, "aufbruch");

    const overview = await service.getCampaignOverview(worldSlug, "himmelsrouten");
    assert.ok(overview);
    assert.equal(overview.chapters.length, 2);
    assert.ok(
      (overview.chapters[1].sortIndex ?? 0) > (overview.chapters[0].sortIndex ?? 0),
    );
  });

  it("counts quests per chapter and lists unassigned ones", async () => {
    const service = createCampaignCockpitService(db);
    const overview1 = await service.getCampaignOverview(worldSlug, "himmelsrouten");
    assert.ok(overview1);
    const chapterId = overview1.chapters[0].id;

    const assigned = await db.page.create({
      data: {
        worldId,
        campaignId,
        parentPageId: chapterId,
        title: "Kapitel-Quest",
        slug: "kapitel-quest",
        type: "quest",
        questStatus: "open",
      },
    });
    await db.page.create({
      data: {
        worldId,
        campaignId,
        title: "Lose Quest",
        slug: "lose-quest",
        type: "quest",
        questStatus: "completed",
      },
    });

    const overview = await service.getCampaignOverview(worldSlug, "himmelsrouten");
    assert.ok(overview);
    const chapter = overview.chapters.find((candidate) => candidate.id === chapterId);
    assert.equal(chapter?.questCounts.total, 1);
    assert.equal(chapter?.questCounts.open, 1);
    assert.equal(overview.unassignedQuests.length, 1);
    assert.equal(overview.unassignedQuests[0].title, "Lose Quest");
    assert.equal(overview.unassignedQuests[0].status, "completed");
    assert.ok(assigned.id);
  });

  it("moves chapters and reassigns quests", async () => {
    const service = createCampaignCockpitService(db);
    let overview = await service.getCampaignOverview(worldSlug, "himmelsrouten");
    assert.ok(overview);
    const [first, second] = overview.chapters;

    await service.moveChapter(worldId, campaignId, second.id, "up");
    overview = await service.getCampaignOverview(worldSlug, "himmelsrouten");
    assert.ok(overview);
    assert.equal(overview.chapters[0].id, second.id);

    const quest = overview.unassignedQuests[0];
    await service.assignQuestToChapter(worldId, quest.id, first.id);
    overview = await service.getCampaignOverview(worldSlug, "himmelsrouten");
    assert.ok(overview);
    assert.equal(overview.unassignedQuests.length, 0);

    await service.assignQuestToChapter(worldId, quest.id, null);
    overview = await service.getCampaignOverview(worldSlug, "himmelsrouten");
    assert.ok(overview);
    assert.equal(overview.unassignedQuests.length, 1);
  });

  it("renders the chapter view with linked events", async () => {
    const service = createCampaignCockpitService(db);
    const overview = await service.getCampaignOverview(worldSlug, "himmelsrouten");
    assert.ok(overview);
    const chapter = overview.chapters.find((candidate) => candidate.questCounts.total > 0);
    assert.ok(chapter);

    const view = await service.getChapterView(worldSlug, "himmelsrouten", chapter.slug, {
      wikiIndex: [],
      graph: null,
    });
    assert.ok(view);
    assert.equal(view.quests.length, 1);

    const event = await db.worldEvent.create({
      data: {
        worldId,
        title: "Sturm über den Routen",
        inGameDate: { year: 1, month: 1, day: 2 },
        entityLinks: { create: [{ pageId: view.quests[0].id, role: "trigger" }] },
      },
    });
    const withEvents = await service.getChapterView(worldSlug, "himmelsrouten", chapter.slug, {
      wikiIndex: [],
      graph: null,
    });
    assert.ok(withEvents);
    assert.equal(withEvents.quests[0].linkedEvents.length, 1);
    assert.equal(withEvents.quests[0].linkedEvents[0].roleLabel, "Auslöser");
    assert.ok(event.id);
  });

  // Vom aufgelösten Kampagnen-Radar hierher gezogen: Dungeons + NSC-Stand
  // gehören jetzt zum Kampagnen-Überblick, gefiltert wie im Dungeon-Cockpit.
  it("lists campaign dungeons and the NPC summary in the overview", async () => {
    const service = createCampaignCockpitService(db);
    await db.page.create({
      data: {
        worldId,
        campaignId,
        title: "Magisterturm",
        slug: "magisterturm",
        type: "dungeon",
        prepStatus: "ready",
      },
    });
    await db.page.create({
      data: { worldId, title: "Alte Mine", slug: "alte-mine", type: "dungeon" },
    });
    await db.page.create({
      data: {
        worldId,
        campaignId,
        title: "Grimm",
        slug: "grimm",
        type: "npc",
        canonicalStatus: "contradictory",
      },
    });
    await db.page.create({
      data: { worldId, title: "Fremder", slug: "fremder", type: "npc" },
    });

    const overview = await service.getCampaignOverview(worldSlug, "himmelsrouten");
    assert.ok(overview);
    assert.equal(overview.dungeons.length, 1);
    assert.equal(overview.dungeons[0].title, "Magisterturm");
    assert.equal(overview.dungeons[0].prepStatus, "ready");
    assert.ok(overview.dungeons[0].href.endsWith("/dungeons/magisterturm"));
    assert.equal(overview.npcSummary.total, 1);
    assert.equal(overview.npcSummary.flagged, 1);
  });

  it("pins pages to a chapter and merges them into the act board", async () => {
    const service = createCampaignCockpitService(db);
    const pins = createStoryArcPinService(db);
    const overview = await service.getCampaignOverview(worldSlug, "himmelsrouten");
    assert.ok(overview);
    const chapter = overview.chapters[0];

    const npc = await db.page.findFirst({ where: { worldId, slug: "grimm" } });
    assert.ok(npc);

    const pin = await pins.pin(worldId, chapter.id, npc.id);
    assert.equal(pin.role, "npc");
    // Doppelt pinnen ist idempotent (upsert auf die Unique-Kante).
    await pins.pin(worldId, chapter.id, npc.id);

    // Quests (type quest) lassen sich nicht pinnen — Rolle nicht ableitbar.
    const quest = await db.page.findFirst({ where: { worldId, type: "quest" } });
    assert.ok(quest);
    await assert.rejects(pins.pin(worldId, chapter.id, quest.id), /nicht.*pinnen/);

    // Ohne Graph (keine [[Wiki-Links]] aufgelöst) trägt allein der Pin die Tafel.
    const view = await service.getChapterView(worldSlug, "himmelsrouten", chapter.slug, {
      wikiIndex: [],
      graph: null,
    });
    assert.ok(view);
    assert.equal(view.pins.length, 1);
    assert.equal(view.pins[0].target.id, npc.id);
    assert.deepEqual(
      view.actRelations.npcs.map((target) => target.id),
      [npc.id],
    );

    await pins.unpin(worldId, view.pins[0].id);
    const after = await service.getChapterView(worldSlug, "himmelsrouten", chapter.slug, {
      wikiIndex: [],
      graph: null,
    });
    assert.equal(after?.pins.length, 0);
  });

  it("derives the act board from the chapter text itself", async () => {
    const service = createCampaignCockpitService(db);
    const created = await service.createChapter({
      worldId,
      campaignId,
      title: "Akt der Tafel",
      content: "Der [[Grimm]] wartet im Turm.",
    });
    const chapterPage = await db.page.findUnique({
      where: { id: created.id },
      include: { contentBlocks: true },
    });
    assert.ok(chapterPage);
    const npc = await db.page.findFirst({ where: { worldId, slug: "grimm" } });
    assert.ok(npc);

    // Handgebautes Graph-Fragment: der Kapitel-Block löst auf den NSC auf.
    const graph = {
      pageIndex: [{ id: npc.id, title: npc.title, slug: npc.slug, type: npc.type }],
      blockTargets: new Map(
        chapterPage.contentBlocks.map((block) => [block.id, [npc.id]]),
      ),
      pages: [],
    };
    const view = await service.getChapterView(worldSlug, "himmelsrouten", created.slug, {
      wikiIndex: [],
      graph: graph as never,
    });
    assert.ok(view);
    // Kein Quest-Text im Spiel — der Treffer kommt allein aus dem Kapiteltext.
    assert.deepEqual(
      view.actRelations.npcs.map((target) => target.id),
      [npc.id],
    );
  });
});

describe("session wrap-up privacy (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;
  let worldId: string;
  let campaignId: string;
  let sessionId: string;
  const worldSlug = "wrapup-test";

  before(async () => {
    const url = createTestDatabaseUrl();
    db = createPrismaClient(url);
    const world = await createUweRepository(url).createWorld({
      name: "WrapUp",
      slug: worldSlug,
    });
    worldId = world.id;
    const campaign = await db.campaign.create({
      data: { worldId, name: "Nachtreise", slug: "nachtreise" },
    });
    campaignId = campaign.id;
    const session = await db.gameSession.create({
      data: { worldId, campaignId, title: "Session 1", sessionNumber: 1, status: "played" },
    });
    sessionId = session.id;
  });

  after(async () => {
    await db.$disconnect();
  });

  it("shows shared notes but NEVER private or draft ones", async () => {
    const player = await db.user.create({
      data: {
        email: "spieler@test.local",
        displayName: "Spieler",
        passwordHash: "x",
      },
    });
    const noteBase = { worldId, campaignId, gameSessionId: sessionId, userId: player.id };
    await db.playerNote.create({
      data: { ...noteBase, content: "Geteilt mit DM", visibility: "dm_only", status: "visible_to_dm" },
    });
    await db.playerNote.create({
      data: { ...noteBase, content: "Privater Gedanke", visibility: "private", status: "visible_to_dm" },
    });
    await db.playerNote.create({
      data: { ...noteBase, content: "Noch Entwurf", visibility: "dm_only", status: "draft" },
    });

    const wrapUp = await createSessionWrapUpService(db).getSessionWrapUp(
      worldSlug,
      "nachtreise",
      sessionId,
    );
    assert.ok(wrapUp);
    assert.equal(wrapUp.sharedNotes.length, 1);
    assert.equal(wrapUp.sharedNotes[0].content, "Geteilt mit DM");
    const contents = wrapUp.sharedNotes.map((note) => note.content).join(" ");
    assert.ok(!contents.includes("Privater Gedanke"));
    assert.ok(!contents.includes("Noch Entwurf"));
  });

  it("ignores session ids from foreign campaigns", async () => {
    const foreignCampaign = await db.campaign.create({
      data: { worldId, name: "Fremd", slug: "fremd" },
    });
    const foreignSession = await db.gameSession.create({
      data: {
        worldId,
        campaignId: foreignCampaign.id,
        title: "Fremde Session",
        sessionNumber: 99,
        status: "played",
      },
    });
    const wrapUp = await createSessionWrapUpService(db).getSessionWrapUp(
      worldSlug,
      "nachtreise",
      foreignSession.id,
    );
    assert.ok(wrapUp);
    assert.equal(wrapUp.session, null);
    assert.equal(wrapUp.sharedNotes.length, 0);
  });
});
