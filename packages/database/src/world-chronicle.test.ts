import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";
import { createWorldCalendarService, DEFAULT_IN_GAME_DATE } from "./world-calendar-service";
import { createWorldEventService } from "./world-event-service";
import { createFactionStateService } from "./faction-state-service";

describe("wave c0a chronicle models", () => {
  let databaseUrl: string;
  let worldId: string;
  let pageId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({ name: "Chronicle Test", slug: "chronicle-test" });
    worldId = world.id;
    const page = await repo.createPage({
      worldId,
      title: "Test Faction",
      slug: "test-faction",
      type: "faction",
    });
    pageId = page.id;
    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("creates world calendar and formats in-game date", async () => {
    const db = createPrismaClient(databaseUrl);
    const calendars = createWorldCalendarService(db);
    const calendar = await calendars.upsertForWorld({ worldId });
    assert.equal(calendar.worldId, worldId);
    assert.deepEqual(calendar.currentDate, DEFAULT_IN_GAME_DATE);
    await db.$disconnect();
  });

  it("creates world events linked to pages", async () => {
    const db = createPrismaClient(databaseUrl);
    const events = createWorldEventService(db);
    const event = await events.create({
      worldId,
      inGameDate: { year: 1, month: 2, day: 5 },
      title: "Rat tagt",
      summaryPlayer: "Die Fraktion trifft sich.",
      linkedPages: [{ pageId, role: "faction" }],
    });
    assert.equal(event.entityLinks.length, 1);
    const forPage = await events.listForPage(pageId);
    assert.equal(forPage.length, 1);
    await db.$disconnect();
  });

  it("upserts faction state for faction pages", async () => {
    const db = createPrismaClient(databaseUrl);
    const factions = createFactionStateService(db);
    const state = await factions.upsert({
      worldId,
      pageId,
      agenda: "Expand influence",
      powerLevel: 3,
    });
    assert.equal(state.pageId, pageId);
    assert.equal(state.powerLevel, 3);
    await db.$disconnect();
  });

  it("filters portal page events by visibility", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const repo = createUweRepository(databaseUrl);
    const world = await repo.getWorldBySlug("chronicle-test");
    assert.ok(world);

    const player = await auth.createUser({
      displayName: "Chronicle Player",
      email: "chronicle-player@uwe.local",
      password: "uwe-dev",
      role: "player",
    });
    await auth.createWorldMembership({
      userId: player.id,
      worldId: world.id,
      role: "player",
    });

    const events = createWorldEventService(db);
    await events.create({
      worldId: world.id,
      inGameDate: { year: 1, month: 3, day: 1 },
      title: "Spieler-sichtbar",
      summaryPlayer: "Öffentlich",
      visibility: "player_visible",
      linkedPages: [{ pageId, role: "involved" }],
    });
    await events.create({
      worldId: world.id,
      inGameDate: { year: 1, month: 3, day: 2 },
      title: "Nur DM",
      summaryPlayer: "Geheim",
      visibility: "dm_only",
      linkedPages: [{ pageId, role: "involved" }],
    });

    const ctx = await auth.buildAccessContextForWorld("chronicle-test", { userId: player.id });
    assert.ok(ctx);

    const pageEvents = await auth.listWorldEventsForPageViewer("chronicle-test", pageId, ctx);
    assert.equal(pageEvents.length, 1);
    assert.equal(pageEvents[0]?.title, "Spieler-sichtbar");
    await db.$disconnect();
  });
});
