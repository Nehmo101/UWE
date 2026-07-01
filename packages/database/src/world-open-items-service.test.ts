import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createGameSessionService } from "./game-session";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";
import {
  createWorldOpenItemsService,
  groupOpenItemsByCategory,
} from "./world-open-items-service";

describe("world open items", () => {
  let databaseUrl: string;
  let worldSlug: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const sessions = createGameSessionService(databaseUrl);

    const world = await repo.createWorld({
      name: "Open Items World",
      slug: "open-items-test",
    });
    worldSlug = world.slug;

    const campaign = await repo.createCampaign({
      worldId: world.id,
      name: "Campaign",
      slug: "main",
    });

    await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Den Turm finden",
      slug: "den-turm-finden",
      type: "quest",
      questStatus: "open",
    });

    await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Händlerin Mara",
      slug: "haendlerin-mara",
      type: "npc",
      publishStatus: "draft",
      canonicalStatus: "draft",
    });

    await sessions.create({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Session 2",
      sessionNumber: 2,
      status: "played",
      openPlots: "Wer ist der Meisterdieb?\nTurm noch offen",
    });

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("aggregates open quests, draft npcs and session plots", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createWorldOpenItemsService(db);
    const items = await service.listForWorld(worldSlug);
    const grouped = groupOpenItemsByCategory(items);

    assert.ok(grouped.open_quest.some((item) => item.title === "Den Turm finden"));
    assert.ok(grouped.draft_npc.some((item) => item.title === "Händlerin Mara"));
    assert.equal(grouped.session_plot.length, 2);
    assert.ok(grouped.session_plot.some((item) => item.summary?.includes("Meisterdieb")));

    await db.$disconnect();
  });
});
