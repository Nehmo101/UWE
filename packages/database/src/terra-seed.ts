import type { UweRepository } from "./repository";

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
    visibility: "player_visible",
    publishStatus: "published",
    canonicalStatus: "canon",
    tags: ["wald", "norden", "feen"],
    aliases: ["Der Große Wald"],
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        visibility: "public",
        content:
          "Arbor erstreckt sich als endloses Blätterdach über den Norden Terras. Reisende berichten von leuchtenden Lichtungen und singenden Bäumen. Im Süden grenzt der Wald an [[Validori]].",
      },
      {
        type: "gm_note",
        sortOrder: 1,
        visibility: "dm_only",
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
    visibility: "public",
    publishStatus: "published",
    canonicalStatus: "canon",
    tags: ["stadt", "hafen", "magie"],
    aliases: ["Stadt der Magister"],
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        visibility: "player_visible",
        content:
          "Validori thront an der Küste des Inneren Meeres. Ihre Türme aus weißem Stein leuchten nachts und weisen Schiffen den Weg. Der [[Magister-Turm von Validori|Leuchtturm]] ist weit sichtbar.",
      },
      {
        type: "player_text",
        sortOrder: 1,
        visibility: "public",
        content:
          "Spielerwissen: In Validori gibt es eine öffentliche Bibliothek mit Karten der Küstenregion.",
      },
      {
        type: "gm_note",
        sortOrder: 2,
        visibility: "dm_only",
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
    visibility: "player_visible",
    publishStatus: "published",
    canonicalStatus: "canon",
    tags: ["reich", "politik"],
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        visibility: "public",
        content:
          "Nepurga kontrolliert die Handelswege zwischen [[Arbor]] und [[Validori]]. Sein Herrscherhaus beansprucht altes Blutrecht über die Feenwälder.",
      },
      {
        type: "relation",
        sortOrder: 1,
        visibility: "player_visible",
        content: "Nepurga behauptet die Oberhoheit über die Feen von Arbor.",
      },
      {
        type: "gm_note",
        sortOrder: 2,
        visibility: "dm_only",
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
    visibility: "dm_only",
    publishStatus: "published",
    canonicalStatus: "canon",
    tags: ["geheim", "festung"],
    contentBlocks: [
      {
        type: "gm_note",
        sortOrder: 0,
        visibility: "dm_only",
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
    visibility: "public",
    publishStatus: "published",
    canonicalStatus: "canon",
    tags: ["turm", "magie", "validori"],
    aliases: ["Der Leuchtturm", "Magister-Turm"],
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        visibility: "public",
        content:
          "Der Magister-Turm ragt über alle Dächer Validoris empor. Sein Leuchtfeuer ist weit über die Bucht sichtbar. Er gehört zur Stadt [[Validori]].",
      },
      {
        type: "gm_note",
        sortOrder: 1,
        visibility: "dm_only",
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
