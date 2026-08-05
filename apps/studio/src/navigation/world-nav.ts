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
        item("world-radar", "Kampagnen-Radar", `${base}/radar`, "radar", "Übersicht", [
          "radar",
          "kampagne",
          "fraktionen",
          "was passiert",
          "world clock",
        ]),
        // Seit dem Cockpit-Umbau die Kampagnen-Wurzel: Liste + Verwaltung +
        // Einstieg in die Kampagnen-Cockpits (Kapitel, Quests, Abschluss).
        item("world-campaigns", "Kampagnen-Cockpit", `${base}/kampagnen`, "swords", "Übersicht", [
          "kampagne",
          "kampagnen",
          "campaign",
          "cockpit",
          "kapitel",
          "story-bogen",
          "session-abschluss",
          "anlegen",
          "umbenennen",
          "verwalten",
        ]),
      ],
    },
    {
      id: "world-wiki",
      title: "Wiki",
      items: [
        item("world-pages", "Wiki / Seiten", `${base}/wiki`, "book-open", "Wiki", ["wiki", "seiten", "pages"]),
        item("world-new-page", "Neue Seite", `${base}/pages/new`, "file-plus", "Wiki", [
          "neu",
          "create",
          "seite",
        ]),
        item("world-read", "Lesen / Bände", `${base}/lesen`, "book-marked", "Wiki", [
          "lesen",
          "band",
          "bände",
          "kampagne",
          "am stück",
          "durchlesen",
          "vorbereiten",
        ]),
        item("world-graph", "Verbindungen / Graph", `${base}/graph`, "share-2", "Wiki", [
          "graph",
          "verbindungen",
          "links",
        ]),
        item("world-terra", "Karten", `${base}/karten`, "map", "Wiki", [
          "karten",
          "karte",
          "terra",
          "map",
          "weltkarte",
          "karteneditor",
          "weltenbau",
        ]),
        item("world-magic-items", "Magic-Item-Werkbank", `${base}/magic-items`, "gem", "Wiki", [
          "item",
          "magic item",
          "werkbank",
          "homebrewery",
          "seltenheit",
        ]),
        // Templates standen als globaler Studio-Eintrag „Inhalte & Medien" —
        // benutzt werden sie aber beim Anlegen einer Seite, und das passiert
        // immer in einer Welt. Die Vorlagen selbst bleiben global (ein NPC-
        // Gerüst ist in jeder Welt dasselbe), der Einstieg liegt in der Welt.
        item("world-templates", "Seiten-Templates", `${base}/templates`, "layout-template", "Wiki", [
          "templates",
          "vorlagen",
          "seiten-templates",
          "quick create",
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
          "live",
        ]),
        item("world-calendar", "Weltuhr", `${base}/calendar`, "clock", "Spiel", [
          "weltuhr",
          "kalender",
          "in-game",
          "zeit",
        ]),
        item("world-chronicle", "Chronik", `${base}/chronicle`, "scroll-text", "Spiel", [
          "chronik",
          "timeline",
          "geschichte",
        ]),
        item("world-prepare-session", "Session vorbereiten", `${base}/prepare-session`, "clipboard-list", "Spiel", [
          "session",
          "prep",
          "vorbereiten",
          "nächste session",
          "generator",
        ]),
        item("world-one-shot", "One-Shot-Generator", `${base}/one-shot`, "wand-sparkles", "Spiel", [
          "one-shot",
          "abenteuer",
          "generator",
          "kanon",
          "ton",
        ]),
        item("world-open-items", "Was ist offen?", `${base}/open-items`, "list-checks", "Spiel", [
          "offen",
          "plots",
          "quests",
          "open",
        ]),
        item("world-treasury", "Gruppenschatz", `${base}/treasury`, "coins", "Spiel", [
          "gruppenschatz",
          "treasury",
          "inventar",
          "währung",
        ]),
        item("world-roll-tables", "Zufallstabellen", `${base}/roll-tables`, "dices", "Spiel", [
          "zufallstabellen",
          "loot",
          "würfeln",
          "roll",
          "tables",
          "namen",
        ]),
        item("world-notes", "Spielernotizen", `${base}/notes`, "sticky-note", "Spiel", [
          "notizen",
          "notes",
        ]),
        item("world-questions", "Spielerfragen", `${base}/questions`, "message-circle", "Spiel", [
          "fragen",
          "spielerfragen",
          "questions",
          "dm",
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
        item("world-print-center", "Print Center", `${base}/print-center`, "printer", "Medien", [
          "print center",
          "handout",
          "npc karte",
          "item karte",
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
        // Die Import-Zentrale hing global unter „Inhalte & Medien" und ließ die
        // Zielwelt aus einer Liste wählen. In der Welt geöffnet ist die Welt
        // bereits gewählt — der Verlauf zeigt nur noch deren Importe.
        item("world-import-central", "Import-Zentrale", `${base}/import-central`, "file-input", "Wissen & KI", [
          "import",
          "zentrale",
          "markdown",
          "obsidian",
          "pdf",
          "kampagne",
        ]),
        // Hintergrund-Jobs waren global unter „Automatisierung". Fast jeder Job
        // trägt ohnehin eine `worldSlug` — die Liste gehört dorthin, wo der Job
        // ausgelöst wurde.
        item("world-jobs", "Hintergrund-Jobs", `${base}/jobs`, "list-checks", "Wissen & KI", [
          "jobs",
          "queue",
          "warteschlange",
          "hintergrund",
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
        item("world-quality", "Wiki-Pflege", `${base}/quality`, "sparkles", "Freigabe & Betrieb", [
          "pflege",
          "qualität",
          "aufräumen",
          "unverlinkt",
          "wiki",
        ]),
        item("world-tags", "Tags", `${base}/tags`, "tags", "Freigabe & Betrieb", [
          "tags",
          "schlagworte",
          "aufräumen",
          "zusammenführen",
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

/** Minimal navigation for live session mode — core tools only. */
export function worldLiveNav(
  worldSlug: string,
  sessionId: string,
  pathname: string,
): ResolvedNavGroup[] {
  const base = `/worlds/${worldSlug}`;
  const groups: NavGroup[] = [
    {
      id: "live-core",
      title: "Live-Session",
      items: [
        item("live-panel", "Live", `${base}/sessions/${sessionId}/live`, "radio", "Live", [
          "live",
          "session",
        ]),
        item("live-session", "Session-Detail", `${base}/sessions/${sessionId}`, "calendar", "Live", [
          "session",
          "notizen",
        ]),
        item("live-roll", "Würfeln", `${base}/roll-tables`, "dice-5", "Live", ["roll", "würfel"]),
        item("live-prepare", "Vorbereitung", `${base}/prepare-session`, "clipboard-list", "Live", [
          "prep",
        ]),
      ],
    },
  ];
  return resolveNavGroups(groups, pathname);
}

/** World sidebar groups with active flags resolved for the current path. */
export function worldSidebar(
  worldSlug: string,
  activePath: string,
): ResolvedNavGroup[] {
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
