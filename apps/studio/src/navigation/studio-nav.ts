/**
 * Studio top-level navigation — the canonical product IA.
 *
 * Seven stable areas: Start, Welten, Knowledge & Brain, AI & Generatoren,
 * Werkzeuge, Organisation, System. This is the single source of truth consumed
 * by the StudioShell sidebar, mobile nav, breadcrumbs, command palette, the
 * System → Navigation overview, and tests.
 */
import { ORGANIZATION_NAV } from "./organization-nav";
import { SYSTEM_NAV } from "./system-nav";
import {
  flattenNavGroups,
  findNavConflicts,
  navGroupsToCommands,
  resolveNavGroups,
  type NavCommand,
  type NavConflicts,
  type NavGroup,
  type NavItem,
  type ResolvedNavGroup,
} from "./types";

const START = "Start";
const WORLDS = "Welten";
const KNOWLEDGE = "Knowledge & Brain";
const AI = "AI & Generatoren";
const TOOLS = "Werkzeuge";
const TOOLS_DAILY = "Erfassen & Alltag";
const TOOLS_CONTENT = "Inhalte & Medien";
const TOOLS_AUTOMATION = "Automatisierung";

export const START_NAV: NavGroup[] = [
  {
    id: "start",
    title: START,
    items: [
      {
        id: "start-search",
        label: "Suche",
        href: "/search",
        icon: "search",
        group: START,
        section: START,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["suche", "search", "command"],
      },
    ],
  },
];

export const WORLDS_NAV: NavGroup[] = [
  {
    id: "worlds",
    title: WORLDS,
    items: [
      {
        id: "worlds-list",
        label: "Alle Welten",
        href: "/worlds",
        icon: "globe",
        group: WORLDS,
        section: WORLDS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["welten", "worlds", "erstellen", "öffnen"],
      },
    ],
  },
];

export const KNOWLEDGE_NAV: NavGroup[] = [
  {
    id: "knowledge",
    title: KNOWLEDGE,
    items: [
      {
        id: "knowledge-brain",
        label: "Brain Store",
        href: "/brain",
        icon: "brain",
        group: KNOWLEDGE,
        section: KNOWLEDGE,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["brain", "wissen", "knowledge", "canon", "fakten"],
      },
      {
        id: "knowledge-assistant",
        label: "Wissensassistent",
        href: "/knowledge",
        icon: "search",
        group: KNOWLEDGE,
        section: KNOWLEDGE,
        permission: ["owner"],
        status: "active",
        source: "studio",
        keywords: ["frage", "wissen", "assistent", "quelle", "life brain"],
      },
    ],
  },
];

export const AI_NAV: NavGroup[] = [
  {
    id: "ai",
    title: AI,
    items: [
      {
        id: "ai-hub",
        label: "KI & Generatoren",
        href: "/ai",
        icon: "sparkles",
        group: AI,
        section: AI,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["ki", "ai", "generator", "dnd", "wissenstext"],
      },
      {
        id: "ai-gateway",
        label: "AI Gateway",
        href: "/admin/ai-gateway",
        icon: "router",
        group: AI,
        section: AI,
        permission: ["owner", "admin"],
        status: "active",
        source: "studio",
        keywords: ["gateway", "provider", "model", "budget"],
      },
      {
        id: "ai-prompt",
        label: "Prompt-Konsole",
        href: "/admin/ai-prompt",
        icon: "terminal",
        group: AI,
        section: AI,
        permission: ["owner", "admin"],
        status: "active",
        source: "studio",
        keywords: ["prompt", "konsole", "ollama", "rtx", "status"],
      },
    ],
  },
];

/**
 * „Werkzeuge" ist eine kanonische Sektion, aber mit 13 heterogenen Einträgen zu
 * überladen. Sie wird daher — wie „Organisation"/„System" — in mehrere NavGroups
 * mit eigenen Sidebar-Sub-Headern aufgeteilt. Alle Einträge behalten
 * `section: TOOLS`, sodass die 7-Sektionen-IA und die Nav-Tests unverändert bleiben.
 */
export const TOOLS_NAV: NavGroup[] = [
  {
    id: "tools-daily",
    title: TOOLS_DAILY,
    items: [
      {
        id: "tools-continue",
        label: "Mach weiter",
        href: "/continue",
        icon: "play",
        group: TOOLS_DAILY,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["weiter", "fortsetzen", "offen", "aufgehört", "projekte"],
      },
    ],
  },
  {
    id: "tools-content",
    title: TOOLS_CONTENT,
    items: [
      {
        id: "tools-templates",
        label: "Templates",
        href: "/templates",
        icon: "layout-template",
        group: TOOLS_CONTENT,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["templates", "vorlagen"],
      },
      {
        id: "tools-prompts",
        label: "Prompt-Bibliothek",
        href: "/prompts",
        icon: "square-terminal",
        group: TOOLS_CONTENT,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["prompt", "bibliothek", "vorlage"],
      },
      {
        id: "tools-image-studio",
        label: "Image Studio",
        href: "/image-studio",
        icon: "image",
        group: TOOLS_CONTENT,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["image", "bild", "medien"],
      },
      {
        id: "tools-import-central",
        label: "Import-Zentrale",
        href: "/import",
        icon: "file-input",
        group: TOOLS_CONTENT,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["import", "knoteforge", "markdown", "obsidian", "pdf", "zentrale"],
      },
    ],
  },
  {
    id: "tools-automation",
    title: TOOLS_AUTOMATION,
    items: [
      {
        id: "tools-jobs",
        label: "Hintergrund-Jobs",
        href: "/jobs",
        icon: "list-checks",
        group: TOOLS_AUTOMATION,
        section: TOOLS,
        permission: ["owner", "admin"],
        status: "active",
        source: "studio",
        keywords: ["jobs", "queue"],
      },
    ],
  },
];

/** All seven Studio areas in canonical order. */
export const STUDIO_NAV: NavGroup[] = [
  ...START_NAV,
  ...WORLDS_NAV,
  ...KNOWLEDGE_NAV,
  ...AI_NAV,
  ...TOOLS_NAV,
  ...ORGANIZATION_NAV,
  ...SYSTEM_NAV,
];

/** Canonical ordered section titles for the Studio sidebar. */
export const STUDIO_SECTIONS = [
  START,
  WORLDS,
  KNOWLEDGE,
  AI,
  TOOLS,
  "Organisation",
  "System",
] as const;

/** Studio sidebar groups with active flags resolved for the current path. */
export function studioSidebar(activePath: string): ResolvedNavGroup[] {
  return resolveNavGroups(STUDIO_NAV, activePath);
}

/** Flat list of all Studio nav items. */
export function studioNavItems(): NavItem[] {
  return flattenNavGroups(STUDIO_NAV);
}

/** Command-palette entries derived from the Studio IA (excludes hidden items). */
export function studioCommands(): NavCommand[] {
  return navGroupsToCommands(STUDIO_NAV);
}

/** Duplicate ids/hrefs/labels across the Studio IA (for Navigation overview + tests). */
export function studioNavConflicts(): NavConflicts {
  return findNavConflicts(studioNavItems());
}
