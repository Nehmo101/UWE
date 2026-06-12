import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";
import { createPrismaClient } from "./client";
import { createWorldOverviewService, type WorldOverviewService } from "./world-overview";

describe("world-overview", () => {
  let service: WorldOverviewService;
  let worldId: string;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    service = createWorldOverviewService(db);

    const world = await repo.createWorld({
      name: "Overview Test",
      slug: "overview-test",
    });
    worldId = world.id;

    await repo.createPage({
      worldId,
      title: "Hafenstadt",
      slug: "hafenstadt",
      type: "location",
      visibility: "public",
      publishStatus: "published",
    });

    await repo.createPage({
      worldId,
      title: "Geheimer Kult",
      slug: "geheimer-kult",
      type: "faction",
      visibility: "dm_only",
      publishStatus: "draft",
    });

    await repo.createPage({
      worldId,
      title: "Kapitänin Mara",
      slug: "kapitaenin-mara",
      type: "npc",
      visibility: "player_visible",
      publishStatus: "published",
    });

    await db.gameSession.create({
      data: {
        worldId,
        title: "Session 1: Ankunft",
        sessionNumber: 1,
        status: "played",
        openPlots: "Wer hat den Hafenmeister bestochen?",
      },
    });

    await db.gameSession.create({
      data: {
        worldId,
        title: "Session 2: Der Kult",
        sessionNumber: 2,
        status: "planned",
      },
    });
  });

  it("returns null for unknown worlds", async () => {
    assert.equal(await service.getWorldOverview("does-not-exist"), null);
  });

  it("aggregates page counts by category and publish status", async () => {
    const overview = await service.getWorldOverview("overview-test");
    assert.ok(overview);

    assert.equal(overview.counts.pages, 3);
    assert.equal(overview.counts.byCategory.orte, 1);
    assert.equal(overview.counts.byCategory.npcs, 1);
    assert.equal(overview.counts.byCategory.fraktionen, 1);
    assert.equal(overview.counts.published, 2);
    assert.equal(overview.counts.drafts, 1);
    assert.equal(overview.counts.gameSessions, 2);
  });

  it("counts only portal-visible pages for the portal status", async () => {
    const overview = await service.getWorldOverview("overview-test");
    assert.ok(overview);

    // Hafenstadt (public/published) + Mara (player_visible/published);
    // Geheimer Kult (dm_only/draft) must never be counted.
    assert.equal(overview.portal.visiblePageCount, 2);
  });

  it("finds the next upcoming session", async () => {
    const overview = await service.getWorldOverview("overview-test");
    assert.ok(overview);
    assert.ok(overview.nextSession);
    assert.equal(overview.nextSession.title, "Session 2: Der Kult");
    assert.equal(overview.nextSession.status, "planned");
  });

  it("collects open plots from past sessions", async () => {
    const overview = await service.getWorldOverview("overview-test");
    assert.ok(overview);
    assert.equal(overview.openPlots.length, 1);
    assert.match(overview.openPlots[0].openPlots, /Hafenmeister/);
  });

  it("lists recently updated pages", async () => {
    const overview = await service.getWorldOverview("overview-test");
    assert.ok(overview);
    assert.equal(overview.recentPages.length, 3);
    const titles = overview.recentPages.map((page) => page.title);
    assert.ok(titles.includes("Geheimer Kult"));
  });
});
