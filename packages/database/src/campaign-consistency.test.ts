import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { checkCampaignConsistency } from "./campaign-consistency";
import { createPrismaClient, type PrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";

describe("campaign consistency gate", () => {
  let db: PrismaClient;
  let worldId: string;
  let campaignId: string;
  let arcId: string;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    const world = await db.world.create({ data: { name: "Gate-Welt", slug: "gate-welt" } });
    worldId = world.id;
    campaignId = (await db.campaign.create({ data: { worldId, name: "Gate-Kampagne", slug: "gate-kampagne" } })).id;
    arcId = (await db.page.create({ data: { worldId, campaignId, title: "Akt I", slug: "akt-i", type: "story_arc" } })).id;
  });

  after(async () => db.$disconnect());

  it("akzeptiert explizit verbundene Quest und Dungeon", async () => {
    await db.page.create({ data: { worldId, campaignId, questStoryArcId: arcId, title: "Gute Quest", slug: "gute-quest", type: "quest" } });
    const root = await db.page.create({ data: { worldId, campaignId, title: "Guter Dungeon", slug: "guter-dungeon", type: "dungeon" } });
    await db.dungeon.create({ data: { worldId, campaignId, rootPageId: root.id, storyArcPageId: arcId, name: root.title, slug: root.slug } });
    assert.deepEqual(await checkCampaignConsistency(db, { campaignId }), []);
  });

  it("meldet eine Quest ohne fachlichen Story-Bogen", async () => {
    const quest = await db.page.create({ data: { worldId, campaignId, parentPageId: arcId, title: "Nur im Seitenbaum", slug: "nur-im-seitenbaum", type: "quest" } });
    const findings = await checkCampaignConsistency(db, { campaignId });
    assert.ok(findings.some((finding) => finding.code === "quest_without_story_arc" && finding.entityId === quest.id));
  });
});
