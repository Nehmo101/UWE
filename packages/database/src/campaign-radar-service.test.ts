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
    assert.equal(radar.dungeons.length, 0);
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

  it("lists dungeons and filters by campaign like the dungeon cockpit", async () => {
    const campaign = await db.campaign.create({
      data: { worldId, name: "Turm", slug: "turm" },
    });
    await db.page.create({
      data: {
        worldId,
        campaignId: campaign.id,
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
        campaignId: campaign.id,
        title: "Kampagnen-Quest",
        slug: "kampagnen-quest",
        type: "quest",
        questStatus: "open",
      },
    });

    const service = createCampaignRadarService(db);

    const all = await service.getRadar("radar-test");
    assert.ok(all);
    assert.equal(all.dungeons.length, 2);
    assert.equal(all.openQuests.length, 2);

    const filtered = await service.getRadar("radar-test", { campaignId: campaign.id });
    assert.ok(filtered);
    assert.equal(filtered.dungeons.length, 1);
    assert.equal(filtered.dungeons[0].title, "Magisterturm");
    assert.equal(filtered.dungeons[0].prepStatus, "ready");
    assert.ok(filtered.dungeons[0].href.endsWith("/dungeons/magisterturm"));
    assert.equal(filtered.openQuests.length, 1);
    assert.equal(filtered.openQuests[0].title, "Kampagnen-Quest");
    // Ohne Kampagnen-Zuordnung fallen die Bestandsseiten aus dem Filter heraus.
    assert.equal(filtered.factions.length, 0);
    assert.equal(filtered.npcSummary.total, 0);
  });

  it("links the last session detail page instead of the list", async () => {
    const session = await db.gameSession.create({
      data: { worldId, title: "Auftakt", sessionNumber: 1, status: "played" },
    });
    const radar = await createCampaignRadarService(db).getRadar("radar-test");
    assert.ok(radar?.lastSession);
    assert.equal(radar.lastSession.id, session.id);
    assert.ok(radar.lastSession.href.endsWith(`/sessions/${session.id}`));
  });

  it("orders recent events by in-game date, not by capture time", async () => {
    // Später erfasst, aber früher in der Weltzeit — muss hinten stehen.
    await db.worldEvent.create({
      data: {
        worldId,
        title: "Frühes Ereignis",
        inGameDate: { year: 1480, month: 1, day: 1 },
        sortOrder: 5,
      },
    });
    await db.worldEvent.create({
      data: {
        worldId,
        title: "Spätes Ereignis",
        inGameDate: { year: 1490, month: 6, day: 15 },
        sortOrder: 1,
      },
    });

    const radar = await createCampaignRadarService(db).getRadar("radar-test");
    assert.ok(radar);
    const titles = radar.recentEvents.map((event) => event.title);
    assert.ok(
      titles.indexOf("Spätes Ereignis") < titles.indexOf("Frühes Ereignis"),
      `Weltzeit-Sortierung verletzt: ${titles.join(", ")}`,
    );
    assert.ok(radar.recentEvents[0].dateLabel.includes("1490"));
  });
});
