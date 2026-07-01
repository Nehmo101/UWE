import type { PageType, Visibility } from "./generated/prisma/client";
import { getPageTemplate } from "./page-templates";

/** Archetype selected when creating a new world (distinct from page templates). */
export type WorldTemplateId = "blank" | "dnd" | "wiki" | "roman" | "wargame";

export interface WorldTemplateOption {
  id: WorldTemplateId;
  name: string;
  description: string;
  seedPageCount: number;
  includesCampaign: boolean;
  includesCalendar: boolean;
}

export interface WorldTemplateSeedPage {
  title: string;
  slug?: string;
  pageTemplateId: string;
  /** Override first block content when the archetype needs custom starter text. */
  starterContent?: string;
  pageType?: PageType;
  visibility?: Visibility;
}

export interface WorldTemplateCampaignSeed {
  name: string;
  slug: string;
  description?: string;
}

export interface WorldTemplateDefinition {
  id: WorldTemplateId;
  name: string;
  description: string;
  campaign?: WorldTemplateCampaignSeed;
  seedPages: WorldTemplateSeedPage[];
  /** Creates a default WorldCalendar when the world is created. */
  seedCalendar?: boolean;
}

const WORLD_TEMPLATES: WorldTemplateDefinition[] = [
  {
    id: "blank",
    name: "Leere Welt",
    description: "Keine Startseiten — du legst alles selbst an.",
    seedPages: [],
  },
  {
    id: "dnd",
    name: "DnD-Kampagne",
    description: "Kampagne plus NPC, Ort, Fraktion, Quest und Session-Plan als Startwiki.",
    campaign: {
      name: "Hauptkampagne",
      slug: "hauptkampagne",
      description: "Standardkampagne für Abenteuer, NPCs und Sessions.",
    },
    seedCalendar: true,
    seedPages: [
      { title: "Start-NPC", slug: "start-npc", pageTemplateId: "npc" },
      { title: "Startort", slug: "startort", pageTemplateId: "ort" },
      { title: "Hauptfraktion", slug: "hauptfraktion", pageTemplateId: "fraktion" },
      { title: "Erste Quest", slug: "erste-quest", pageTemplateId: "quest" },
      { title: "Nächste Session", slug: "naechste-session", pageTemplateId: "session" },
    ],
  },
  {
    id: "wiki",
    name: "Projekt-Wiki",
    description: "Strukturiertes Wissenswiki ohne Kampagne.",
    seedPages: [
      {
        title: "Übersicht",
        slug: "uebersicht",
        pageTemplateId: "blank",
        starterContent: [
          "## Zweck",
          "Worum geht es in diesem Wiki?",
          "",
          "## Schnellstart",
          "- [[Themenbereich]]",
          "- [[Referenz]]",
        ].join("\n"),
        visibility: "player_visible",
      },
      {
        title: "Themenbereich",
        slug: "themenbereich",
        pageTemplateId: "blank",
        starterContent: [
          "## Kernthemen",
          "- ",
          "",
          "## Offene Fragen",
          "- ",
        ].join("\n"),
        visibility: "player_visible",
      },
      {
        title: "Referenz",
        slug: "referenz",
        pageTemplateId: "handout",
        starterContent: "Kurzreferenz oder Glossar-Einträge für das Projekt.",
        visibility: "player_visible",
      },
    ],
  },
  {
    id: "roman",
    name: "Roman / Erzählung",
    description: "Fiction-Projekt mit Figuren, Ort und erstem Kapitel.",
    seedPages: [
      {
        title: "Handlung & Outline",
        slug: "handlung-outline",
        pageTemplateId: "blank",
        starterContent: [
          "## Prämisse",
          "Worum geht die Geschichte in einem Satz?",
          "",
          "## Aktstruktur",
          "1. Setup",
          "2. Konfrontation",
          "3. Auflösung",
        ].join("\n"),
        visibility: "dm_only",
      },
      { title: "Protagonist", slug: "protagonist", pageTemplateId: "npc" },
      { title: "Schauplatz", slug: "schauplatz", pageTemplateId: "ort" },
      {
        title: "Kapitel 1",
        slug: "kapitel-1",
        pageTemplateId: "blank",
        starterContent: [
          "## Szene",
          "Wo und wann beginnt das Kapitel?",
          "",
          "## Entwurf",
          "",
        ].join("\n"),
        visibility: "dm_only",
      },
    ],
  },
  {
    id: "wargame",
    name: "Wargame / Tabletop-Schlacht",
    description: "Tabletop-Gefechte mit Armeen, Terrain und Szenario-Setup.",
    campaign: {
      name: "Haupttheater",
      slug: "haupttheater",
      description: "Einsatzgebiet für Szenarien, Armeen und Schlachten.",
    },
    seedCalendar: true,
    seedPages: [
      { title: "Spielerarmee", slug: "spielerarmee", pageTemplateId: "fraktion" },
      { title: "Gegner", slug: "gegner", pageTemplateId: "fraktion" },
      { title: "Schlachtfeld", slug: "schlachtfeld", pageTemplateId: "ort" },
      {
        title: "Szenario",
        slug: "szenario",
        pageTemplateId: "blank",
        starterContent: [
          "## Ziel",
          "Was soll auf dem Tisch entschieden werden?",
          "",
          "## Aufstellung",
          "- Spielerarmee: [[Spielerarmee]]",
          "- Gegner: [[Gegner]]",
          "- Terrain: [[Schlachtfeld]]",
          "",
          "## Siegbedingungen",
          "- ",
        ].join("\n"),
        visibility: "dm_only",
      },
      {
        title: "Einheitenreferenz",
        slug: "einheitenreferenz",
        pageTemplateId: "handout",
        starterContent: "Kurzreferenz für Einheiten, Werte und Spezialregeln.",
        visibility: "player_visible",
      },
    ],
  },
];

export function listWorldTemplateOptions(): WorldTemplateOption[] {
  return WORLD_TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    seedPageCount: template.seedPages.length,
    includesCampaign: Boolean(template.campaign),
    includesCalendar: Boolean(template.seedCalendar),
  }));
}

export function getWorldTemplate(id: string | null | undefined): WorldTemplateDefinition | null {
  if (!id) return null;
  return WORLD_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function resolveWorldTemplateId(id: string | null | undefined): WorldTemplateId {
  const template = getWorldTemplate(id);
  return template?.id ?? "blank";
}

export interface AppliedWorldTemplatePage {
  id: string;
  title: string;
  slug: string;
  type: PageType;
}

export interface AppliedWorldTemplateResult {
  campaignId: string | null;
  pages: AppliedWorldTemplatePage[];
}

/** Build content blocks for a seed page from a page template slug. */
export function buildSeedPageBlocks(
  seed: WorldTemplateSeedPage,
): Array<{ type: string; sortOrder: number; visibility: Visibility; content: string }> {
  const pageTemplate = getPageTemplate(seed.pageTemplateId);
  if (!pageTemplate) {
    return [
      {
        type: "rich_text",
        sortOrder: 0,
        visibility: seed.visibility ?? "dm_only",
        content: seed.starterContent ?? "",
      },
    ];
  }

  return pageTemplate.blocks.map((block, index) => ({
    type: block.type,
    sortOrder: index,
    visibility: block.visibility,
    content: index === 0 ? (seed.starterContent ?? block.content) : block.content,
  }));
}

export function seedPageDefaults(seed: WorldTemplateSeedPage): {
  pageType: PageType;
  visibility: Visibility;
} {
  const pageTemplate = getPageTemplate(seed.pageTemplateId);
  return {
    pageType: seed.pageType ?? pageTemplate?.pageType ?? "lore",
    visibility: seed.visibility ?? pageTemplate?.defaultVisibility ?? "dm_only",
  };
}
