import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import {
  createDungeonCockpitService,
} from "./dungeon-cockpit";
import { buildWorldWikiIndex } from "./page-service";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

describe("UWE dungeon cockpit", () => {
  let databaseUrl: string;
  let worldId: string;
  let worldSlug: string;
  let dungeonId: string;
  let levelId: string;
  let roomId: string;
  let roomSlug: string;
  let encounterId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const auth = createAuthService(db);
    const dungeons = createDungeonCockpitService(databaseUrl);

    const world = await repo.createWorld({
      name: "Dungeon Test World",
      slug: "dungeon-test",
      description: "Dungeon cockpit tests",
    });
    worldId = world.id;
    worldSlug = world.slug;

    const player = await auth.createUser({
      displayName: "Player",
      email: "player-dungeon@test.local",
      password: "test",
      portalAccess: true,
      studioAccess: false,
    });

    await auth.createWorldMembership({
      userId: player.id,
      worldId: world.id,
    });

    const dungeon = await dungeons.createWithGeneratedSlug({
      worldId: world.id,
      parentPageId: null,
      title: "Verlassener Tempel",
      type: "dungeon",
      prepStatus: "unprepared",
    });
    dungeonId = dungeon.id;

    const level = await dungeons.createWithGeneratedSlug({
      worldId: world.id,
      parentPageId: dungeon.id,
      title: "Ebene 1",
      type: "dungeon_level",
      prepStatus: "ready",
      contentBlocks: [
        {
          type: "player_text",
          sortOrder: 0,
          content: "Ein zeremonielles Foyer, kalt und still.",
        },
        {
          type: "rich_text",
          sortOrder: 1,
          content: "Leitmotiv: Bürokratie, die den Untergang überlebt hat.",
        },
      ],
    });
    levelId = level.id;

    const room = await dungeons.createWithGeneratedSlug({
      worldId: world.id,
      parentPageId: level.id,
      title: "Eingangshalle",
      slug: "eingangshalle",
      type: "room",
      prepStatus: "ready",
      contentBlocks: [
        {
          type: "player_text",
          sortOrder: 0,
          content: "Ihr betretet eine hallende Halle mit Blick auf [[Geheimes Heiligtum]].",
        },
        {
          type: "rich_text",
          sortOrder: 1,
          content: "Staubige Säulen säumen den Weg.",
        },
        {
          type: "rich_text",
          sortOrder: 2,
          content: "Geheime Falle: DC 15 Wahrnehmung.",
        },
      ],
    });
    roomId = room.id;
    roomSlug = room.slug;

    const encounter = await dungeons.createWithGeneratedSlug({
      worldId: world.id,
      parentPageId: room.id,
      title: "Skelett-Wache",
      type: "encounter",
      prepStatus: "unprepared",
    });
    encounterId = encounter.id;

    await repo.createPage({
      worldId: world.id,
      title: "Geheimes Heiligtum",
      slug: "geheimes-heiligtum",
      type: "location",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          content: "Nur für den GM sichtbar.",
        },
      ],
    });

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("generates unique slugs for dungeons with the same title (QF5)", async () => {
    const dungeons = createDungeonCockpitService(databaseUrl);

    const first = await dungeons.createWithGeneratedSlug({
      worldId,
      parentPageId: null,
      title: "Gleicher Dungeon-Titel",
      type: "dungeon",
      prepStatus: "unprepared",
    });
    const second = await dungeons.createWithGeneratedSlug({
      worldId,
      parentPageId: null,
      title: "Gleicher Dungeon-Titel",
      type: "dungeon",
      prepStatus: "unprepared",
    });

    assert.ok(first.slug);
    assert.ok(second.slug);
    assert.notEqual(first.slug, second.slug, "duplicate titles must get distinct slugs");
  });

  it("builds dungeon > level > room hierarchy", async () => {
    const dungeons = createDungeonCockpitService(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const wikiIndex = await buildWorldWikiIndex(repo, worldSlug);

    const overview = await dungeons.getDungeonOverview(
      worldSlug,
      "verlassener-tempel",
      wikiIndex,
    );
    assert.ok(overview);
    assert.equal(overview.levels.length, 1);
    assert.equal(overview.levels[0]?.parentPageId, dungeonId);

    const level = await dungeons.getLevelOverview(
      worldSlug,
      "verlassener-tempel",
      "ebene-1",
      wikiIndex,
    );
    assert.ok(level);
    assert.equal(level.rooms.length, 1);
    assert.equal(level.rooms[0]?.parentPageId, levelId);
    // Der komplette Ebenentext gehört zur Übersicht — ohne ihn zeigt das
    // Cockpit auf der Ebenen-Seite nur die Raumliste.
    assert.ok(level.html.includes("Ein zeremonielles Foyer"));
    assert.ok(level.html.includes("Leitmotiv"));

    const room = await dungeons.getRoomCockpit(
      worldSlug,
      "verlassener-tempel",
      "ebene-1",
      roomSlug,
      wikiIndex,
    );
    assert.ok(room);
    assert.equal(room.room.parentPageId, levelId);
    assert.equal(room.level.id, levelId);
    assert.equal(room.dungeon.id, dungeonId);
  });

  it("assigns encounters to their room parent", async () => {
    const dungeons = createDungeonCockpitService(databaseUrl);
    const encounterPage = await dungeons.getPageById(encounterId);

    assert.ok(encounterPage);
    assert.equal(encounterPage.parentPageId, roomId);
    assert.equal(encounterPage.type, "encounter");
  });

  it("links assets to dungeon and room pages", async () => {
    const dungeons = createDungeonCockpitService(databaseUrl);
    const repo = createUweRepository(databaseUrl);

    const asset = await repo.createAsset({
      worldId,
      title: "Tempel-Karte",
      type: "map",
      storageKey: "maps/temple.png",
    });

    await dungeons.linkAsset(dungeonId, asset.id);
    await dungeons.linkAsset(roomId, asset.id);

    const overview = await dungeons.getDungeonOverview(
      worldSlug,
      "verlassener-tempel",
      await buildWorldWikiIndex(repo, worldSlug),
    );
    assert.ok(overview);
    assert.equal(overview.assets.length, 1);
    assert.equal(overview.assets[0]?.id, asset.id);

    const room = await dungeons.getRoomCockpit(
      worldSlug,
      "verlassener-tempel",
      "ebene-1",
      roomSlug,
      await buildWorldWikiIndex(repo, worldSlug),
    );
    assert.ok(room);
    assert.equal(room.assets.length, 1);
    assert.equal(room.assets[0]?.title, "Tempel-Karte");
  });

  it("resolves wiki links in dungeon room text for DM view", async () => {
    const dungeons = createDungeonCockpitService(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const wikiIndex = await buildWorldWikiIndex(repo, worldSlug);

    const room = await dungeons.getRoomCockpit(
      worldSlug,
      "verlassener-tempel",
      "ebene-1",
      roomSlug,
      wikiIndex,
    );
    assert.ok(room);
    assert.ok(room.html.includes("wiki-link"));
    assert.ok(room.html.includes("Geheimes Heiligtum"));
  });

});
