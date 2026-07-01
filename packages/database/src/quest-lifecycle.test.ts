import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import {
  createQuestLifecycleService,
  isOpenQuest,
  QUEST_LIFECYCLE_LABELS,
} from "./quest-lifecycle-service";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

describe("quest lifecycle", () => {
  let databaseUrl: string;
  let questPageId: string;
  let lorePageId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);

    const world = await repo.createWorld({
      name: "Quest Lifecycle World",
      slug: "quest-lifecycle-test",
    });

    const campaign = await repo.createCampaign({
      worldId: world.id,
      name: "Campaign",
      slug: "main",
    });

    const quest = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Hauptquest",
      slug: "hauptquest",
      type: "quest",
    });
    questPageId = quest.id;

    const lore = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Lore",
      slug: "lore",
      type: "lore",
    });
    lorePageId = lore.id;

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("treats null and open as open quests", () => {
    assert.equal(isOpenQuest(null), true);
    assert.equal(isOpenQuest(undefined), true);
    assert.equal(isOpenQuest("open"), true);
    assert.equal(isOpenQuest("completed"), false);
    assert.equal(isOpenQuest("failed"), false);
  });

  it("updates quest status only for quest pages", async () => {
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const quests = createQuestLifecycleService(db);

    const updated = await quests.updateQuestStatus(questPageId, "completed");
    assert.equal(updated.questStatus, "completed");
    assert.equal(QUEST_LIFECYCLE_LABELS.completed, "Erledigt");

    await assert.rejects(
      () => quests.updateQuestStatus(lorePageId, "completed"),
      /Quest-Status ist nur für Quest-Seiten/,
    );

    const world = await repo.getWorldBySlug("quest-lifecycle-test");
    assert.ok(world);

    const openOnly = await quests.listQuestsForWorld(world.id, { status: "open" });
    assert.equal(openOnly.length, 0);

    const completed = await quests.listQuestsForWorld(world.id, { status: "completed" });
    assert.equal(completed.length, 1);
    assert.equal(completed[0].id, questPageId);

    await db.$disconnect();
  });
});
