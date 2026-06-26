import type { ContentBlockType, PageType, Visibility } from "./generated/prisma/client";
import { slugifyDe } from "./slug-utils";

/**
 * Page templates for Quick Create.
 *
 * Templates are static, code-defined skeletons: they pre-fill page type,
 * default visibility and a sensible set of content blocks (player-facing
 * text plus DM-only notes). Secret material always lands in `dm_only`
 * blocks so nothing leaks into the player portal by default.
 */

export interface PageTemplateBlock {
  type: ContentBlockType;
  visibility: Visibility;
  content: string;
}

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  pageType: PageType;
  defaultVisibility: Visibility;
  titlePlaceholder: string;
  blocks: PageTemplateBlock[];
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "blank",
    name: "Leere Seite",
    description: "Freie Seite ohne Vorlage – Typ und Inhalt selbst bestimmen.",
    pageType: "lore",
    defaultVisibility: "dm_only",
    titlePlaceholder: "Seitentitel",
    blocks: [
      {
        type: "rich_text",
        visibility: "player_visible",
        content: "",
      },
    ],
  },
  {
    id: "npc",
    name: "NPC",
    description: "Nicht-Spieler-Charakter mit Spieler-Beschreibung und DM-Geheimnissen.",
    pageType: "npc",
    defaultVisibility: "dm_only",
    titlePlaceholder: "Name des NPCs",
    blocks: [
      {
        type: "rich_text",
        visibility: "player_visible",
        content: [
          "## Erscheinung",
          "Wie wirkt diese Person auf den ersten Blick?",
          "",
          "## Auftreten & Stimme",
          "Sprechweise, Marotten, typische Sätze.",
          "",
          "## Bekannte Verbindungen",
          "Gehört zu [[Fraktion]] und lebt in [[Ort]].",
        ].join("\n"),
      },
      {
        type: "gm_note",
        visibility: "dm_only",
        content: [
          "## Wahre Motivation",
          "Was will dieser NPC wirklich?",
          "",
          "## Geheimnisse",
          "- ",
          "",
          "## Plot-Hooks",
          "- ",
        ].join("\n"),
      },
    ],
  },
  {
    id: "ort",
    name: "Ort",
    description: "Stadt, Dorf oder Schauplatz mit Atmosphäre und DM-Hooks.",
    pageType: "location",
    defaultVisibility: "dm_only",
    titlePlaceholder: "Name des Ortes",
    blocks: [
      {
        type: "rich_text",
        visibility: "player_visible",
        content: [
          "## Beschreibung",
          "Was sehen, hören und riechen die Charaktere hier?",
          "",
          "## Wichtige Orte",
          "- ",
          "",
          "## Bekannte Personen",
          "- [[NPC]]",
        ].join("\n"),
      },
      {
        type: "gm_note",
        visibility: "dm_only",
        content: [
          "## Geheimnisse & Hooks",
          "- ",
          "",
          "## Gefahren",
          "- ",
        ].join("\n"),
      },
    ],
  },
  {
    id: "fraktion",
    name: "Fraktion",
    description: "Organisation oder Gruppierung mit öffentlichem Ruf und wahrer Agenda.",
    pageType: "faction",
    defaultVisibility: "dm_only",
    titlePlaceholder: "Name der Fraktion",
    blocks: [
      {
        type: "rich_text",
        visibility: "player_visible",
        content: [
          "## Öffentliches Bild",
          "Wofür ist diese Fraktion bekannt?",
          "",
          "## Ziele",
          "- ",
          "",
          "## Bekannte Mitglieder",
          "- [[NPC]]",
        ].join("\n"),
      },
      {
        type: "gm_note",
        visibility: "dm_only",
        content: [
          "## Wahre Agenda",
          "Was verfolgt die Fraktion im Verborgenen?",
          "",
          "## Interne Konflikte",
          "- ",
        ].join("\n"),
      },
    ],
  },
  {
    id: "quest",
    name: "Quest",
    description: "Auftrag mit Ziel, Belohnung und verborgenen Wendungen.",
    pageType: "quest",
    defaultVisibility: "dm_only",
    titlePlaceholder: "Name der Quest",
    blocks: [
      {
        type: "rich_text",
        visibility: "player_visible",
        content: [
          "## Auftrag",
          "Wer gibt die Quest und was soll erreicht werden?",
          "",
          "## Belohnung",
          "- ",
          "",
          "## Bekannte Hinweise",
          "- ",
        ].join("\n"),
      },
      {
        type: "gm_note",
        visibility: "dm_only",
        content: [
          "## Wendungen",
          "Was läuft anders, als die Gruppe denkt?",
          "",
          "## Mögliche Ausgänge",
          "- Erfolg: ",
          "- Scheitern: ",
        ].join("\n"),
      },
    ],
  },
  {
    id: "session",
    name: "Session-Plan",
    description: "Vorbereitungsseite für den nächsten Spielabend (DM-only).",
    pageType: "session",
    defaultVisibility: "dm_only",
    titlePlaceholder: "Session-Titel",
    blocks: [
      {
        type: "rich_text",
        visibility: "dm_only",
        content: [
          "## Recap",
          "Wo hat die Gruppe zuletzt aufgehört?",
          "",
          "## Geplante Szenen",
          "1. ",
          "2. ",
          "3. ",
          "",
          "## Wichtige NPCs",
          "- [[NPC]]",
          "",
          "## Mögliche Encounter",
          "- ",
        ].join("\n"),
      },
      {
        type: "gm_note",
        visibility: "dm_only",
        content: [
          "## Notfall-Ideen",
          "Falls die Gruppe abbiegt:",
          "- ",
        ].join("\n"),
      },
    ],
  },
  {
    id: "handout",
    name: "Handout",
    description: "Spieler-Handout, z. B. Brief, Aushang oder Notiz.",
    pageType: "handout",
    defaultVisibility: "player_visible",
    titlePlaceholder: "Titel des Handouts",
    blocks: [
      {
        type: "rich_text",
        visibility: "player_visible",
        content: [
          "Text des Handouts, so wie die Spieler ihn lesen sollen.",
        ].join("\n"),
      },
      {
        type: "gm_note",
        visibility: "dm_only",
        content: [
          "## Kontext für den DM",
          "Wann und wie bekommen die Spieler dieses Handout?",
        ].join("\n"),
      },
    ],
  },
];

export function getPageTemplate(id: string | null | undefined): PageTemplate | null {
  if (!id) return null;
  return PAGE_TEMPLATES.find((template) => template.id === id) ?? null;
}

/** Derive a URL-safe slug from a page title (umlaut-aware). */
export function slugifyPageTitle(title: string): string {
  return slugifyDe(title);
}

export { pickUniqueSlug } from "./slug-utils";
