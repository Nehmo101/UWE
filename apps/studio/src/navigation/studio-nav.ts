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

export const START_NAV: NavGroup[] = [
  {
    id: "start",
    title: START,
    items: [
      {
        id: "start-today",
        label: "Heute",
        href: "/today",
        icon: "sun",
        group: START,
        section: START,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["heute", "today", "cockpit", "dashboard"],
      },
      {
        id: "start-capture-quick",
        label: "Schnell erfassen",
        href: "/capture?quick=1",
        icon: "plus",
        group: START,
        section: START,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["capture", "inbox", "schnell", "notiz"],
      },
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
        id: "knowledge-life-brain",
        label: "Life Brain",
        href: "/life-brain",
        icon: "notebook-pen",
        group: KNOWLEDGE,
        section: KNOWLEDGE,
        permission: ["owner"],
        status: "active",
        source: "studio",
        keywords: ["life", "brain", "personal", "rtx"],
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

export const TOOLS_NAV: NavGroup[] = [
  {
    id: "tools",
    title: TOOLS,
    items: [
      {
        id: "tools-capture",
        label: "Capture / Inbox",
        href: "/capture",
        icon: "inbox",
        group: TOOLS,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["capture", "inbox"],
      },
      {
        id: "tools-scan-inbox",
        label: "Scan Inbox",
        href: "/scan-inbox",
        icon: "scan-line",
        group: TOOLS,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["scan", "ocr", "dokument", "inbox", "vertrag", "rechnung", "beleg"],
      },
      {
        id: "tools-continue",
        label: "Mach weiter",
        href: "/continue",
        icon: "play",
        group: TOOLS,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["weiter", "fortsetzen", "offen", "aufgehört", "projekte"],
      },
      {
        id: "tools-finance",
        label: "Finanzen / Abos",
        href: "/finance",
        icon: "wallet",
        group: TOOLS,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["finanzen", "abos", "kosten", "verträge", "kündigung"],
      },
      {
        id: "tools-prompts",
        label: "Prompt-Bibliothek",
        href: "/prompts",
        icon: "square-terminal",
        group: TOOLS,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["prompt", "bibliothek", "vorlage", "agent", "cursor", "claude"],
      },
      {
        id: "tools-household",
        label: "Haushalt",
        href: "/household",
        icon: "house",
        group: TOOLS,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["haushalt", "wartung", "müll", "termine", "rauchmelder", "erinnerung"],
      },
      {
        id: "tools-templates",
        label: "Templates",
        href: "/templates",
        icon: "layout-template",
        group: TOOLS,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["templates", "vorlagen"],
      },
      {
        id: "tools-kitchen",
        label: "Küche",
        href: "/kitchen",
        icon: "utensils",
        group: TOOLS,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["küche", "kitchen", "rezepte", "essen", "kochen", "essensplaner"],
      },
      {
        id: "tools-image-studio",
        label: "Image Studio",
        href: "/image-studio",
        icon: "image",
        group: TOOLS,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["image", "bild", "medien"],
      },
      {
        id: "tools-reviews",
        label: "Reviews",
        href: "/admin/reviews",
        icon: "check-check",
        group: TOOLS,
        section: TOOLS,
        permission: ["owner", "admin"],
        status: "active",
        source: "studio",
        keywords: ["reviews", "freigabe"],
      },
      {
        id: "tools-agent-jobs",
        label: "Agent Jobs",
        href: "/admin/agent-jobs",
        icon: "bot",
        group: TOOLS,
        section: TOOLS,
        permission: ["owner", "admin"],
        status: "active",
        source: "studio",
        keywords: ["agent", "jobs"],
      },
      {
        id: "tools-import-central",
        label: "Import-Zentrale",
        href: "/import",
        icon: "file-input",
        group: TOOLS,
        section: TOOLS,
        permission: ["owner", "admin", "dm"],
        status: "active",
        source: "studio",
        keywords: ["import", "knoteforge", "markdown", "obsidian", "pdf", "zentrale"],
      },
      {
        id: "tools-jobs",
        label: "Jobs",
        href: "/jobs",
        icon: "list-checks",
        group: TOOLS,
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
