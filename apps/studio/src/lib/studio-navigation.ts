import { isLikelyGameSessionId } from "./session-route";
import { studioCommands } from "../navigation/studio-nav";
import { worldNavItems as canonicalWorldNavItems } from "../navigation/world-nav";

/** Horizontal cockpit tabs for world overview (reduced to cockpit-level areas). */
export function worldCockpitTabItems(worldSlug: string, active?: WorldNavKey) {
  const tabKeys: WorldNavKey[] = [
    "overview",
    "pages",
    "sessions",
    "prepare-session",
    "dungeons",
    "assets",
    "brain",
  ];
  return worldNavItems(worldSlug, active).filter((item) => tabKeys.includes(item.key));
}

/** DM tools surfaced on the world dashboard for discoverability (canonical world IA). */
export function worldDmToolQuickLinks(worldSlug: string): { label: string; href: string }[] {
  const highlightIds = new Set([
    "world-radar",
    "world-prepare-session",
    "world-one-shot",
    "world-open-items",
    "world-page-review",
    "world-quality",
    "world-inspector",
    "world-roll-tables",
    "world-print-center",
    "world-ai-runs",
    "world-atlas",
    "world-magic-items",
  ]);
  return canonicalWorldNavItems(worldSlug)
    .filter((item) => highlightIds.has(item.id))
    .map((item) => ({ label: item.label, href: item.href }));
}

export type WorldNavKey =
  | "overview"
  | "pages"
  | "sessions"
  | "calendar"
  | "chronicle"
  | "treasury"
  | "dungeons"
  | "assets"
  | "labels"
  | "notes"
  | "soundboard"
  | "graph"
  | "inspector"
  | "import"
  | "brain"
  | "ai-runs"
  | "dnd-api"
  | "backup"
  | "new-page"
  | "radar"
  | "page-review"
  | "atlas"
  | "magic-items"
  | "prepare-session"
  | "one-shot"
  | "open-items"
  | "roll-tables"
  | "questions"
  | "print-center"
  | "quality";

export type WorldBottomNavKey = "overview" | "content" | "sessions" | "tools" | "more";

export type WorldNavSectionId = "overview" | "content" | "sessions" | "dungeons" | "media" | "tools";

export interface WorldNavItem {
  key: WorldNavKey;
  label: string;
  href: string;
  active?: boolean;
}

export interface WorldNavSection {
  id: WorldNavSectionId;
  title: string;
  items: WorldNavItem[];
}

/** Canonical grouped world sidebar for Studio. */
export function worldNavSections(worldSlug: string, active?: WorldNavKey): WorldNavSection[] {
  const base = `/worlds/${worldSlug}`;
  const sections: {
    id: WorldNavSectionId;
    title: string;
    items: { key: WorldNavKey; label: string; href: string }[];
  }[] = [
    {
      id: "overview",
      title: "Übersicht",
      items: [{ key: "overview", label: "Dashboard", href: `${base}/dashboard` }],
    },
    {
      id: "content",
      title: "Inhalte",
      items: [
        { key: "pages", label: "Seiten", href: base },
        { key: "new-page", label: "Neue Seite", href: `${base}/pages/new` },
      ],
    },
    {
      id: "sessions",
      title: "Sessions",
      items: [
        { key: "sessions", label: "Sessions", href: `${base}/sessions` },
        { key: "prepare-session", label: "Session vorbereiten", href: `${base}/prepare-session` },
        { key: "calendar", label: "Weltuhr", href: `${base}/calendar` },
        { key: "chronicle", label: "Chronik", href: `${base}/chronicle` },
        { key: "treasury", label: "Gruppenschatz", href: `${base}/treasury` },
        { key: "notes", label: "Spielernotizen", href: `${base}/notes` },
      ],
    },
    {
      id: "dungeons",
      title: "Dungeons",
      items: [{ key: "dungeons", label: "Dungeons", href: `${base}/dungeons` }],
    },
    {
      id: "media",
      title: "Medien",
      items: [
        { key: "assets", label: "Medien & Assets", href: `${base}/assets` },
        { key: "soundboard", label: "Soundboard", href: `${base}/soundboard` },
        { key: "labels", label: "Labels & Print", href: `${base}/labels` },
      ],
    },
    {
      id: "tools",
      title: "Tools",
      items: [
        { key: "brain", label: "Brain Store", href: `${base}/brain` },
        { key: "graph", label: "Wissensgraph", href: `${base}/graph` },
        { key: "atlas", label: "Atlas", href: `${base}/atlas` },
        { key: "inspector", label: "Kanon & Leaks", href: `${base}/inspector` },
        { key: "quality", label: "Wiki-Pflege", href: `${base}/quality` },
        { key: "ai-runs", label: "KI-Läufe", href: `${base}/ai-runs` },
        { key: "import", label: "Import", href: `${base}/import` },
        { key: "dnd-api", label: "DnD API", href: `${base}/dnd-api` },
        { key: "backup", label: "Backup", href: `${base}/backup` },
      ],
    },
  ];

  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      active: item.key === active,
    })),
  }));
}

/** Flat world nav list for command palette, breadcrumbs, and legacy adapters. */
export function worldNavItems(worldSlug: string, active?: WorldNavKey): WorldNavItem[] {
  return worldNavSections(worldSlug, active).flatMap((section) => section.items);
}

/** Map world nav key to mobile bottom nav active tab. */
export function worldBottomNavKey(active: WorldNavKey, isSearching = false): WorldBottomNavKey {
  if (active === "overview" || active === "radar") return "overview";
  if (
    active === "pages" ||
    active === "new-page" ||
    active === "graph" ||
    active === "atlas" ||
    active === "magic-items" ||
    active === "page-review" ||
    isSearching
  ) {
    return "content";
  }
  if (
    active === "sessions" ||
    active === "notes" ||
    active === "calendar" ||
    active === "chronicle" ||
    active === "treasury" ||
    active === "prepare-session" ||
    active === "one-shot" ||
    active === "open-items" ||
    active === "roll-tables" ||
    active === "questions" ||
    active === "dungeons"
  ) {
    return "sessions";
  }
  if (
    active === "brain" ||
    active === "inspector" ||
    active === "ai-runs" ||
    active === "import" ||
    active === "dnd-api" ||
    active === "backup" ||
    active === "quality" ||
    active === "assets" ||
    active === "soundboard" ||
    active === "labels" ||
    active === "print-center"
  ) {
    return "tools";
  }
  return "more";
}

/** Campaign filter sidebar block used on world subpages with campaign scope. */
export function campaignNavItems(
  basePath: string,
  campaigns: { slug: string; name: string }[],
  selectedSlug?: string,
) {
  return [
    { label: "Alle Kampagnen", href: basePath, active: !selectedSlug },
    ...campaigns.map((campaign) => ({
      label: campaign.name,
      href: `${basePath}?campaign=${campaign.slug}`,
      active: selectedSlug === campaign.slug,
    })),
  ];
}

/** Resolve icon-rail active id from Studio path. */
export function resolveStudioRailActiveId(activePath: string): string | undefined {
  const normalized = activePath.split("?")[0]?.replace(/\/$/, "") || "/today";
  if (normalized.startsWith("/today")) return "today";
  if (normalized.startsWith("/worlds") || normalized.startsWith("/search")) return "worlds";
  if (
    normalized.startsWith("/capture") ||
    normalized.startsWith("/templates") ||
    normalized.startsWith("/import") ||
    normalized.startsWith("/workshop") ||
    normalized.startsWith("/projects") ||
    normalized.startsWith("/ideas") ||
    normalized.startsWith("/bugs") ||
    normalized.startsWith("/contracts")
  ) {
    return "create";
  }
  if (
    normalized.startsWith("/ai") ||
    normalized.startsWith("/image-studio") ||
    normalized.startsWith("/mail") ||
    normalized.startsWith("/calendar") ||
    normalized.startsWith("/brain") ||
    normalized.startsWith("/life-brain") ||
    normalized.startsWith("/admin/reviews") ||
    normalized.startsWith("/admin/agent-jobs") ||
    normalized.startsWith("/system/rtx-connector")
  ) {
    return "media-ai";
  }
  if (
    normalized.startsWith("/system") ||
    normalized.startsWith("/admin") ||
    normalized.startsWith("/jobs") ||
    normalized.startsWith("/backup") ||
    normalized.startsWith("/settings") ||
    normalized.startsWith("/hardware")
  ) {
    return "system";
  }
  return undefined;
}

/** Resolve active world nav from pathname. */
export function resolveWorldNavKey(pathname: string, worldSlug: string): WorldNavKey {
  const base = `/worlds/${worldSlug}`;
  const normalized = pathname.replace(/\/$/, "");

  if (normalized === `${base}/radar`) return "radar";
  if (normalized === `${base}/dashboard`) return "overview";
  if (normalized === base) return "pages";
  const sessionDetailMatch = normalized.match(new RegExp(`^${base}/sessions/([^/]+)$`));
  if (sessionDetailMatch) {
    const segment = sessionDetailMatch[1] ?? "";
    return isLikelyGameSessionId(segment) ? "sessions" : "pages";
  }
  if (normalized.startsWith(`${base}/sessions`)) return "sessions";
  if (normalized.startsWith(`${base}/calendar`)) return "calendar";
  if (normalized.startsWith(`${base}/chronicle`)) return "chronicle";
  if (normalized.startsWith(`${base}/treasury`)) return "treasury";
  if (normalized.startsWith(`${base}/prepare-session`)) return "prepare-session";
  if (normalized.startsWith(`${base}/one-shot`)) return "one-shot";
  if (normalized.startsWith(`${base}/open-items`)) return "open-items";
  if (normalized.startsWith(`${base}/roll-tables`)) return "roll-tables";
  if (normalized.startsWith(`${base}/questions`)) return "questions";
  if (normalized.startsWith(`${base}/dungeons`)) return "dungeons";
  if (normalized.startsWith(`${base}/assets`)) return "assets";
  if (normalized.startsWith(`${base}/labels`)) return "labels";
  if (normalized.startsWith(`${base}/print-center`)) return "print-center";
  if (normalized.startsWith(`${base}/notes`)) return "notes";
  if (normalized.startsWith(`${base}/soundboard`)) return "soundboard";
  if (normalized.startsWith(`${base}/graph`)) return "graph";
  if (normalized.startsWith(`${base}/atlas`)) return "atlas";
  if (normalized.startsWith(`${base}/magic-items`)) return "magic-items";
  if (normalized.startsWith(`${base}/page-review`)) return "page-review";
  if (normalized.startsWith(`${base}/inspector`)) return "inspector";
  if (normalized.startsWith(`${base}/quality`)) return "quality";
  if (normalized.startsWith(`${base}/brain`)) return "brain";
  if (normalized.startsWith(`${base}/ai-runs`)) return "ai-runs";
  if (normalized.startsWith(`${base}/import`)) return "import";
  if (normalized.startsWith(`${base}/dnd-api`)) return "dnd-api";
  if (normalized.startsWith(`${base}/backup`)) return "backup";
  if (normalized.startsWith(`${base}/pages/new`)) return "new-page";
  if (normalized.match(new RegExp(`^${base}/[^/]+/[^/]+$`))) return "pages";
  if (normalized.match(new RegExp(`^${base}/[^/]+/[^/]+/edit$`))) return "pages";

  return "overview";
}

export interface StudioPaletteCommand {
  id: string;
  label: string;
  href: string;
  group: string;
  keywords?: string[];
}

const PAGE_TEMPLATE_SHORTCUTS: {
  id: string;
  label: string;
  template: string;
  keywords: string[];
}[] = [
  { id: "new-npc", label: "NPC erstellen", template: "npc", keywords: ["create", "charakter"] },
  { id: "new-ort", label: "Ort erstellen", template: "ort", keywords: ["create", "location", "stadt"] },
  {
    id: "new-fraktion",
    label: "Fraktion erstellen",
    template: "fraktion",
    keywords: ["create", "faction", "gilde"],
  },
  { id: "new-quest", label: "Quest erstellen", template: "quest", keywords: ["create", "auftrag"] },
  {
    id: "new-handout",
    label: "Handout erstellen",
    template: "handout",
    keywords: ["create", "brief"],
  },
];

/** Command-palette entries derived from canonical Studio IA. */
export function studioCommandPaletteCommands(options: {
  worlds: { name: string; slug: string }[];
  worldSlug?: string | null;
  pathname?: string;
}): StudioPaletteCommand[] {
  const { worlds, worldSlug, pathname = "" } = options;
  const list: StudioPaletteCommand[] = [];

  list.push({
    id: "quick-capture",
    label: "Schnell erfassen",
    href: "/capture?quick=1",
    group: "Aktionen",
    keywords: ["capture", "notiz", "erfassen", "todo", "idee", "inbox", "quick"],
  });

  if (worldSlug) {
    const base = `/worlds/${worldSlug}`;
    const world = worlds.find((entry) => entry.slug === worldSlug);
    const fallbackGroup = world ? `Welt: ${world.name}` : "Aktuelle Welt";

    for (const item of canonicalWorldNavItems(worldSlug)) {
      list.push({
        id: item.id,
        label: `${item.label} öffnen`,
        href: item.href,
        group: `${fallbackGroup} / ${item.group}`,
        keywords: item.keywords,
      });
    }

    for (const shortcut of PAGE_TEMPLATE_SHORTCUTS) {
      list.push({
        id: shortcut.id,
        label: shortcut.label,
        href: `${base}/pages/new?template=${shortcut.template}`,
        group: `${fallbackGroup} / Inhalte`,
        keywords: shortcut.keywords,
      });
    }

    const pageMatch = pathname.match(
      /^\/worlds\/[^/]+\/(?:pages|npcs|orte|fraktionen|quests|handouts|items|notes|encounters|secrets|traps|puzzles|loot|rooms)\/([^/]+)/,
    );
    if (pageMatch) {
      list.push({
        id: "new-label-from-url",
        label: "Label aus aktueller Seite",
        href: `${base}/labels/new`,
        group: `${fallbackGroup} / Medien`,
        keywords: ["label", "quelle"],
      });
    }
  }

  for (const command of studioCommands()) {
    list.push({
      id: command.id,
      label: `${command.label} öffnen`,
      href: command.href,
      group: command.group,
      keywords: command.keywords,
    });
  }

  for (const world of worlds) {
    if (world.slug === worldSlug) continue;
    list.push({
      id: `open-world-${world.slug}`,
      label: `Welt öffnen: ${world.name}`,
      href: `/worlds/${world.slug}/dashboard`,
      group: "Welten",
      keywords: [world.slug],
    });
  }

  return list;
}

/** Breadcrumb trail for world-scoped Studio pages. */
export function studioWorldBreadcrumbs(
  worldName: string,
  worldSlug: string,
  segments: { label: string; href?: string }[] = [],
): { label: string; href?: string }[] {
  return [
    { label: "Welten", href: "/worlds" },
    { label: worldName, href: `/worlds/${worldSlug}/dashboard` },
    ...segments,
  ];
}
