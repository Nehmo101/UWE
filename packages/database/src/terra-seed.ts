import type { UweRepository } from "./repository";
import type { PrismaClient } from "./client";
import { createWorldCalendarService } from "./world-calendar-service";
import { createWorldEventService } from "./world-event-service";

export async function seedTerraChronicle(
  db: PrismaClient,
  worldId: string,
  pages: {
    validori: { id: string };
    nepurga: { id: string };
  },
) {
  const calendars = createWorldCalendarService(db);
  const calendar = await calendars.upsertForWorld({
    worldId,
    name: "Kalender von Terra",
    epochLabel: "Zeitalter des Erwachens",
    currentDate: { year: 472, month: 3, day: 12 },
    months: [
      { key: "frost", name: "Frostmond", daysInMonth: 30 },
      { key: "bluete", name: "Blütenmond", daysInMonth: 30 },
      { key: "sonne", name: "Sonnenmond", daysInMonth: 30 },
      { key: "ernte", name: "Erntemond", daysInMonth: 30 },
    ],
    dayNames: ["Sol", "Lun", "Mar", "Mer", "Jov", "Ven", "Sat"],
  });

  const events = createWorldEventService(db);
  await events.create({
    worldId,
    calendarId: calendar.id,
    inGameDate: { year: 472, month: 2, day: 14 },
    title: "Rat von Validori tagt",
    summaryPlayer:
      "Die Magister von Validori beraten über Handelswege und Gerüchte aus Nepurga.",
    summaryDm: "Der Rat plant eine geheime Gesandtschaft nach Nepurga.",
    linkedPages: [{ pageId: pages.validori.id, role: "location" }],
  });

  await events.create({
    worldId,
    calendarId: calendar.id,
    inGameDate: { year: 472, month: 3, day: 1 },
    title: "Nepurga erweitert Grenzposten",
    summaryPlayer: "Truppenbewegungen nahe Arbor werden beobachtet.",
    linkedPages: [{ pageId: pages.nepurga.id, role: "faction" }],
  });
}

export async function seedTerraWorld(repo: UweRepository) {
  const world = await repo.createWorld({
    name: "Terra",
    slug: "terra",
    description:
      "Die Hauptwelt von UWE — ein reiches Fantasy-Setting mit alten Mächten, vergessenen Türmen und verborgenen Intrigen.",
  });

  const campaign = await repo.createCampaign({
    worldId: world.id,
    name: "Schatten über Validori",
    slug: "schatten-ueber-validori",
    description: "Die Spieler entdecken politische Intrigen zwischen Nepurga und Validori.",
  });

  const arbor = await repo.createPage({
    worldId: world.id,
    campaignId: campaign.id,
    title: "Arbor",
    slug: "arbor",
    type: "region",
    summary: "Ein uralter Wald im Norden, Heimat der Feen und verborgener Pfade.",
    canonicalStatus: "canon",
    tags: ["wald", "norden", "feen"],
    aliases: ["Der Große Wald"],
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        content:
          "Arbor erstreckt sich als endloses Blätterdach über den Norden Terras. Reisende berichten von leuchtenden Lichtungen und singenden Bäumen. Im Süden grenzt der Wald an [[Validori]].",
      },
      {
        type: "rich_text",
        sortOrder: 1,
        content:
          "Geheime Information: Unter Arbor schlummert ein Portal zu den Feenreichen. Nepurga versucht, es zu kontrollieren.",
      },
    ],
  });

  const validori = await repo.createPage({
    worldId: world.id,
    campaignId: campaign.id,
    title: "Validori",
    slug: "validori",
    type: "location",
    summary: "Die leuchtende Hafenstadt der Magister und Gilden.",
    canonicalStatus: "canon",
    tags: ["stadt", "hafen", "magie"],
    aliases: ["Stadt der Magister"],
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        content:
          "Validori thront an der Küste des Inneren Meeres. Ihre Türme aus weißem Stein leuchten nachts und weisen Schiffen den Weg. Der [[Magister-Turm von Validori|Leuchtturm]] ist weit sichtbar.",
      },
      {
        type: "player_text",
        sortOrder: 1,
        content:
          "Spielerwissen: In Validori gibt es eine öffentliche Bibliothek mit Karten der Küstenregion.",
      },
      {
        type: "rich_text",
        sortOrder: 2,
        content:
          "Der Rat der Magister plant heimlich, Nepurga als Vasallenstaat anzuerkennen — gegen den Willen von [[Shagottar]].",
      },
    ],
  });

  const nepurga = await repo.createPage({
    worldId: world.id,
    campaignId: campaign.id,
    title: "Nepurga",
    slug: "nepurga",
    type: "faction",
    summary: "Ein aufstrebendes Reich zwischen Wald und Küste.",
    canonicalStatus: "canon",
    tags: ["reich", "politik"],
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        content:
          "Nepurga kontrolliert die Handelswege zwischen [[Arbor]] und [[Validori]]. Sein Herrscherhaus beansprucht altes Blutrecht über die Feenwälder.",
      },
      {
        type: "relation",
        sortOrder: 1,
        content: "Nepurga behauptet die Oberhoheit über die Feen von Arbor.",
      },
      {
        type: "rich_text",
        sortOrder: 2,
        content:
          "Shagottar hält Nepurga nur nominell unter Kontrolle. Ein Bürgerkrieg brodet, falls die Vasallität endet.",
      },
    ],
  });

  const shagottar = await repo.createPage({
    worldId: world.id,
    title: "Shagottar",
    slug: "shagottar",
    type: "location",
    summary: "Geheime Festung — nur für den DM bekannt.",
    canonicalStatus: "canon",
    tags: ["geheim", "festung"],
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        content:
          "Shagottar ist der wahre Machtzentrum hinter Nepurga. Verlinkt von [[Validori]] aus GM-Notizen.",
      },
    ],
  });

  const magisterTurm = await repo.createPage({
    worldId: world.id,
    campaignId: campaign.id,
    title: "Magister-Turm von Validori",
    slug: "magister-turm-von-validori",
    type: "location",
    summary: "Der höchste Turm der Stadt — Sitz des Erzmagisters.",
    canonicalStatus: "canon",
    tags: ["turm", "magie", "validori"],
    aliases: ["Der Leuchtturm", "Magister-Turm"],
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        content:
          "Der Magister-Turm ragt über alle Dächer Validoris empor. Sein Leuchtfeuer ist weit über die Bucht sichtbar. Er gehört zur Stadt [[Validori]].",
      },
      {
        type: "rich_text",
        sortOrder: 1,
        content:
          "Im obersten Gemach liegt ein verbotenes Artefakt, das die Magier vor den Nepurga-Spionen verbergen.",
      },
    ],
  });

  await repo.createPageLink({
    sourcePageId: validori.id,
    targetPageId: magisterTurm.id,
    relationType: "contains",
    label: "Validori enthält den Magister-Turm",
  });

  await repo.createPageLink({
    sourcePageId: nepurga.id,
    targetPageId: arbor.id,
    relationType: "controls",
    label: "Nepurga kontrolliert Arbor",
  });

  return {
    world,
    campaign,
    pages: {
      arbor,
      validori,
      nepurga,
      shagottar,
      magisterTurm,
    },
  };
}
