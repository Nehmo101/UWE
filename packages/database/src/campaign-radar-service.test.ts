import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  createCampaignRadarService,
  formatClockLabel,
} from "./campaign-radar-service";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

describe("formatClockLabel (pure)", () => {
  it("assembles day/month/year with the calendar name", () => {
    assert.equal(
      formatClockLabel("Terra-Kalender", { day: 12, monthName: "Regen", year: 1487 }, null),
      "Terra-Kalender: 12. Regen. 1487",
    );
  });
  it("falls back to the name when the date shape is unknown", () => {
    assert.equal(formatClockLabel("Kal", 42, null), "Kal");
  });
  it("returns null when nothing is known", () => {
    assert.equal(formatClockLabel(null, null, null), null);
  });
  it("uses the epoch label when present", () => {
    assert.equal(formatClockLabel(null, {}, "3. Zeitalter"), "3. Zeitalter");
  });
});

describe("campaign radar (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;
  let worldId: string;

  before(async () => {
    const url = createTestDatabaseUrl();
    db = createPrismaClient(url);
    const world = await createUweRepository(url).createWorld({ name: "Radar", slug: "radar-test" });
    worldId = world.id;
  });

  after(async () => {
    await db.$disconnect();
  });

  it("returns null for an unknown world", async () => {
    assert.equal(await createCampaignRadarService(db).getRadar("does-not-exist"), null);
  });

  it("returns sane empty defaults for a fresh world", async () => {
    const radar = await createCampaignRadarService(db).getRadar("radar-test");
    assert.ok(radar);
    assert.equal(radar.factions.length, 0);
    assert.equal(radar.openQuests.length, 0);
    assert.equal(radar.lastSession, null);
    assert.equal(radar.npcSummary.total, 0);
    assert.equal(radar.canonConflicts, 0);
    assert.equal(radar.clockLabel, null);
  });

  it("aggregates a faction, an open quest and an NPC", async () => {
    const questPage = await db.page.create({
      data: { worldId, title: "Die Suche", slug: "die-suche", type: "quest", questStatus: "open" },
    });
    const factionPage = await db.page.create({
      data: { worldId, title: "Rote Hand", slug: "rote-hand", type: "faction" },
    });
    await db.factionState.create({
      data: { worldId, pageId: factionPage.id, agenda: "Chaos stiften", powerLevel: 7 },
    });
    await db.page.create({
      data: { worldId, title: "Grimm", slug: "grimm", type: "npc", canonicalStatus: "contradictory" },
    });

    const radar = await createCampaignRadarService(db).getRadar("radar-test");
    assert.ok(radar);
    assert.equal(radar.factions.length, 1);
    assert.equal(radar.factions[0].agenda, "Chaos stiften");
    assert.equal(radar.factions[0].powerLevel, 7);
    assert.equal(radar.openQuests.length, 1);
    assert.equal(radar.openQuests[0].title, "Die Suche");
    assert.equal(radar.npcSummary.total, 1);
    assert.equal(radar.npcSummary.flagged, 1);
    assert.equal(radar.canonConflicts, 1);
    assert.ok(radar.factions[0].href.includes("rote-hand"));
    assert.ok(questPage.id);
  });
});
