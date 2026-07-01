/**
 * World cockpit navigation — stable per-world IA inside Studio.
 *
 * The navigation does not change between world subpages: type filters
 * (NPCs/Orte/Fraktionen) are filters inside Wiki, not separate nav worlds.
 * Part of the central navigation contract (see ./types.ts).
 */
import {
  findNavConflicts,
  flattenNavGroups,
  navGroupsToCommands,
  resolveNavGroups,
  type NavCommand,
  type NavConflicts,
  type NavGroup,
  type NavItem,
  type ResolvedNavGroup,
} from "./types";

const SECTION = "Welt";

export function worldNav(worldSlug: string): NavGroup[] {
  const base = `/worlds/${worldSlug}`;

  return [
    {
      id: "world-overview",
      title: "Übersicht",
      items: [
        item("world-dashboard", "Übersicht", `${base}/dashboard`, "layout-dashboard", "Übersicht", [
          "dashboard",
          "cockpit",
        ]),
      ],
    },
    {
      id: "world-wiki",
      title: "Wiki",
      items: [
        item("world-pages", "Wiki / Seiten", base, "book-open", "Wiki", ["wiki", "seiten", "pages"]),
        item("world-new-page", "Neue Seite", `${base}/pages/new`, "file-plus", "Wiki", [
          "neu",
          "create",
          "seite",
        ]),
        item("world-graph", "Verbindungen / Graph", `${base}/graph`, "share-2", "Wiki", [
          "graph",
          "verbindungen",
          "links",
        ]),
        item("world-atlas", "Atlas / Karte", `${base}/atlas`, "map", "Wiki", [
          "atlas",
          "karte",
          "map",
          "weltkarte",
        ]),
      ],
    },
    {
      id: "world-play",
      title: "Spiel",
      items: [
        item("world-sessions", "Sessions", `${base}/sessions`, "calendar-days", "Spiel", [
          "sessions",
          "spielabend",
          "recap",
        ]),
        item("world-treasury", "Gruppenschatz", `${base}/treasury`, "coins", "Spiel", [
          "gruppenschatz",
          "treasury",
          "inventar",
          "währung",
        ]),
        item("world-notes", "Spielernotizen", `${base}/notes`, "sticky-note", "Spiel", [
          "notizen",
          "notes",
        ]),
        item("world-dungeons", "Dungeons", `${base}/dungeons`, "castle", "Spiel", [
          "dungeons",
          "räume",
          "encounter",
        ]),
      ],
    },
    {
      id: "world-media",
      title: "Medien",
      items: [
        item("world-assets", "Medien / Assets", `${base}/assets`, "image", "Medien", [
          "medien",
          "assets",
          "karten",
          "handouts",
        ]),
        item("world-soundboard", "Soundboard", `${base}/soundboard`, "music", "Medien", [
          "soundboard",
          "audio",
          "musik",
        ]),
        item("world-labels", "Labels & Print", `${base}/labels`, "tag", "Medien", [
          "labels",
          "print",
          "druck",
        ]),
      ],
    },
    {
      id: "world-knowledge",
      title: "Wissen & KI",
      items: [
        item("world-brain", "Brain / Wissen", `${base}/brain`, "brain", "Wissen & KI", [
          "brain",
          "wissen",
          "canon",
          "fakten",
        ]),
        item("world-ai-runs", "KI / Generatoren", `${base}/ai-runs`, "sparkles", "Wissen & KI", [
          "ki",
          "ai",
          "generator",
          "läufe",
        ]),
        item("world-dnd-api", "DnD API", `${base}/dnd-api`, "dices", "Wissen & KI", ["dnd", "api", "srd"]),
        item("world-import", "Import & Konvertierung", `${base}/import`, "import", "Wissen & KI", [
          "import",
          "konvertierung",
          "knoteforge",
        ]),
      ],
    },
    {
      id: "world-share",
      title: "Freigabe & Betrieb",
      items: [
        item("world-inspector", "Freigaben / Kanon", `${base}/inspector`, "shield-check", "Freigabe & Betrieb", [
          "freigabe",
          "kanon",
          "leaks",
          "portal",
        ]),
        item("world-backup", "Backup", `${base}/backup`, "database-backup", "Freigabe & Betrieb", [
          "backup",
          "sicherung",
        ]),
      ],
    },
  ];
}

function item(
  id: string,
  label: string,
  href: string,
  icon: string,
  group: string,
  keywords: string[],
): NavItem {
  return {
    id,
    label,
    href,
    icon,
    group,
    section: SECTION,
    permission: ["owner", "admin", "dm"],
    status: "active",
    source: "world",
    keywords,
  };
}

/** World sidebar groups with active flags resolved for the current path. */
export function worldSidebar(worldSlug: string, activePath: string): ResolvedNavGroup[] {
  return resolveNavGroups(worldNav(worldSlug), activePath);
}

/** Flat list of world nav items. */
export function worldNavItems(worldSlug: string): NavItem[] {
  return flattenNavGroups(worldNav(worldSlug));
}

/** Command-palette entries for a world. */
export function worldCommands(worldSlug: string): NavCommand[] {
  return navGroupsToCommands(worldNav(worldSlug));
}

/** Duplicate detection for a world's nav (for tests). */
export function worldNavConflicts(worldSlug: string): NavConflicts {
  return findNavConflicts(worldNavItems(worldSlug));
}
