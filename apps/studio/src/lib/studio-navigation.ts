import { resolvePortalSessionHref, resolveUweAppUrls } from "@uwe/auth";

import { isLikelyGameSessionId } from "./session-route";

export type StudioNavSectionId =
  | "portal"
  | "heute"
  | "worlds"
  | "leben"
  | "werkstatt"
  | "wissen"
  | "medien"
  | "ki"
  | "system"
  | "admin";

export interface StudioNavItem {
  label: string;
  href: string;
  active?: boolean;
  badge?: string;
}

export interface StudioNavSection {
  id: StudioNavSectionId;
  title: string;
  items: StudioNavItem[];
}

const STUDIO_NAV_SECTIONS: { id: StudioNavSectionId; title: string; items: { label: string; href: string }[] }[] =
  [
    {
      id: "heute",
      title: "Heute",
      items: [{ label: "Heute", href: "/today" }],
    },
    {
      id: "worlds",
      title: "Welten",
      items: [
        { label: "Welten", href: "/worlds" },
        { label: "Globale Suche", href: "/search" },
        { label: "Templates", href: "/templates" },
      ],
    },
    {
      id: "leben",
      title: "Leben",
      items: [
        { label: "Capture", href: "/capture" },
        { label: "Projekte", href: "/projects" },
        { label: "Verträge", href: "/contracts" },
        { label: "Hardware", href: "/hardware" },
      ],
    },
    {
      id: "werkstatt",
      title: "Werkstatt",
      items: [{ label: "Werkstatt", href: "/workshop" }],
    },
    {
      id: "wissen",
      title: "Wissen",
      items: [
        { label: "Life Brain", href: "/life-brain" },
        { label: "Brain Store", href: "/brain" },
      ],
    },
    {
      id: "medien",
      title: "Medien",
      items: [
        { label: "Image Studio", href: "/image-studio" },
        { label: "Mail Center", href: "/mail" },
        { label: "Kalender", href: "/calendar" },
      ],
    },
    {
      id: "ki",
      title: "KI",
      items: [
        { label: "KI", href: "/ai" },
        { label: "Reviews", href: "/admin/reviews" },
        { label: "Agent Jobs", href: "/admin/agent-jobs" },
      ],
    },
    {
      id: "system",
      title: "System",
      items: [
        { label: "System-Hub", href: "/system" },
        { label: "Jobs", href: "/jobs" },
        { label: "Backup", href: "/backup" },
        { label: "Einstellungen", href: "/settings" },
      ],
    },
    {
      id: "admin",
      title: "Admin",
      items: [
        { label: "Admin Übersicht", href: "/admin" },
        { label: "Benutzer", href: "/admin/users" },
        { label: "Security", href: "/admin/security" },
        { label: "Audit Log", href: "/admin/audit-log" },
        { label: "Tags", href: "/admin/tags" },
        { label: "Cookbook", href: "/admin/cookbook" },
      ],
    },
  ];

/** Sectioned Studio sidebar — canonical IA structure. */
export function studioSidebarSections(activePath: string): StudioNavSection[] {
  return STUDIO_NAV_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    items: section.items.map((item) => ({
      ...item,
      active: isStudioNavItemActive(activePath, item.href),
    })),
  }));
}

const UNIFIED_SIDEBAR_LINKS: {
  id: StudioNavSectionId;
  title: string;
  hrefs: string[];
}[] = [
  {
    id: "portal",
    title: "Portal",
    hrefs: ["__portal__", "__portal_worlds__"],
  },
  {
    id: "heute",
    title: "Heute",
    hrefs: ["/today"],
  },
  {
    id: "worlds",
    title: "Welten",
    hrefs: ["/worlds", "/search", "/templates"],
  },
  {
    id: "leben",
    title: "Leben",
    hrefs: ["/capture", "/projects", "/contracts", "/hardware"],
  },
  {
    id: "werkstatt",
    title: "Werkstatt",
    hrefs: ["/workshop"],
  },
  {
    id: "wissen",
    title: "Wissen",
    hrefs: ["/life-brain", "/brain"],
  },
  {
    id: "medien",
    title: "Medien",
    hrefs: ["/image-studio", "/mail", "/calendar"],
  },
  {
    id: "ki",
    title: "KI",
    hrefs: ["/ai", "/admin/reviews", "/admin/agent-jobs"],
  },
  {
    id: "system",
    title: "System",
    hrefs: ["/system", "/jobs", "/backup", "/settings"],
  },
  {
    id: "admin",
    title: "Admin",
    hrefs: [
      "/admin",
      "/admin/users",
      "/admin/security",
      "/admin/audit-log",
      "/admin/tags",
      "/admin/cookbook",
    ],
  },
];

function resolveUnifiedHref(
  href: string,
  portalUrl: string,
): { label: string; href: string } | null {
  if (href === "__portal__") {
    if (!portalUrl) return null;
    const sessionHref = resolvePortalSessionHref(process.env, { currentApp: "studio" });
    return { label: "Spieler-Portal", href: sessionHref };
  }
  if (href === "__portal_worlds__") {
    if (!portalUrl) return null;
    const base = portalUrl.replace(/\/$/, "");
    return { label: "Welten (Spieler)", href: `${base}/worlds` };
  }

  for (const section of STUDIO_NAV_SECTIONS) {
    const item = section.items.find((entry) => entry.href === href);
    if (item) return item;
  }
  return null;
}

/**
 * Unified app sidebar — Portal plus consolidated Studio IA (cockpit mockup).
 */
export function studioUnifiedSidebarSections(
  activePath: string,
  options: { portalUrl?: string } = {},
): StudioNavSection[] {
  const urls = resolveUweAppUrls(process.env);
  const portalUrl = (options.portalUrl ?? urls.portalUrl ?? "").replace(/\/$/, "");
  const flat = studioFlatNav(activePath);

  return UNIFIED_SIDEBAR_LINKS.map((group) => {
    const items: StudioNavItem[] = [];
    for (const href of group.hrefs) {
      const resolved = resolveUnifiedHref(href, portalUrl);
      if (!resolved) continue;
      const active = flat.find((item) => item.href === resolved.href)?.active;
      items.push({
        ...resolved,
        active: active ?? isStudioNavItemActive(activePath, resolved.href),
      });
    }
    return {
      id: group.id,
      title: group.title,
      items,
    };
  });
}

/** Horizontal cockpit tabs for world overview (subset of world nav). */
export function worldCockpitTabItems(worldSlug: string, active?: WorldNavKey) {
  const tabKeys: WorldNavKey[] = [
    "overview",
    "pages",
    "sessions",
    "dungeons",
    "assets",
    "brain",
    "inspector",
  ];
  return worldNavItems(worldSlug, active).filter((item) => tabKeys.includes(item.key));
}

/** Flat nav list for AdminShell compatibility (legacy). */
export function studioFlatNav(activePath: string): StudioNavItem[] {
  return STUDIO_NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      active: isStudioNavItemActive(activePath, item.href),
    })),
  );
}

/** Compact dashboard sidebar — most-used Studio links. */
export function studioDashboardNav(activePath: string): StudioNavItem[] {
  const keys = [
    "/today",
    "/worlds",
    "/capture",
    "/ai",
    "/system",
    "/admin",
    "/search",
    "/brain",
    "/image-studio",
    "/backup",
    "/settings",
  ];

  const all = studioFlatNav(activePath);
  return keys
    .map((href) => all.find((item) => item.href === href))
    .filter((item): item is StudioNavItem => Boolean(item));
}

function isStudioNavItemActive(activePath: string, href: string): boolean {
  const normalizedActive = normalizeStudioPath(activePath);
  const normalizedHref = normalizeStudioPath(href);

  if (normalizedActive === normalizedHref) return true;

  // Tabbed settings: /settings?tab=integrations
  if (normalizedHref.startsWith("/settings?tab=")) {
    const tab = normalizedHref.split("tab=")[1];
    return normalizedActive === `/settings?tab=${tab}`;
  }

  // Tabbed system hub: /system?tab=homelab
  if (normalizedHref.startsWith("/system?tab=")) {
    const tab = normalizedHref.split("tab=")[1];
    return normalizedActive === `/system?tab=${tab}`;
  }

  if (normalizedHref === "/system" && normalizedActive.startsWith("/system")) {
    return true;
  }

  // Legacy routes that map to the System section
  if (normalizedHref === "/system") {
    if (normalizedActive === "/admin/status" || normalizedActive.startsWith("/admin/status/")) {
      return true;
    }
  }

  // Prefix match for nested routes (e.g. /worlds/terra/... → /worlds)
  if (
    normalizedHref !== "/admin" &&
    !normalizedHref.includes("?") &&
    normalizedActive.startsWith(`${normalizedHref}/`)
  ) {
    return true;
  }

  return false;
}

function normalizeStudioPath(path: string): string {
  const [pathname, query] = path.split("?");
  const trimmed = pathname.replace(/\/$/, "") || "/";
  return query ? `${trimmed}?${query}` : trimmed;
}

export type WorldNavKey =
  | "overview"
  | "pages"
  | "sessions"
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
  | "new-page";

export type WorldBottomNavKey = "overview" | "pages" | "search" | "inspector" | "more";

export interface WorldNavItem {
  key: WorldNavKey;
  label: string;
  href: string;
  active?: boolean;
}

/** Canonical world sidebar for Studio. */
export function worldNavItems(worldSlug: string, active?: WorldNavKey): WorldNavItem[] {
  const base = `/worlds/${worldSlug}`;

  const items: { key: WorldNavKey; label: string; href: string }[] = [
    { key: "overview", label: "Übersicht", href: `${base}/dashboard` },
    { key: "pages", label: "Seiten", href: base },
    { key: "sessions", label: "Sessions", href: `${base}/sessions` },
    { key: "dungeons", label: "Dungeons", href: `${base}/dungeons` },
    { key: "assets", label: "Medien & Assets", href: `${base}/assets` },
    { key: "labels", label: "Labels", href: `${base}/labels` },
    { key: "notes", label: "Spielernotizen", href: `${base}/notes` },
    { key: "soundboard", label: "Soundboard", href: `${base}/soundboard` },
    { key: "graph", label: "Wissensgraph", href: `${base}/graph` },
    { key: "brain", label: "Brain Store", href: `${base}/brain` },
    { key: "inspector", label: "Kanon & Leaks", href: `${base}/inspector` },
    { key: "ai-runs", label: "KI-Läufe", href: `${base}/ai-runs` },
    { key: "import", label: "Import", href: `${base}/import` },
    { key: "dnd-api", label: "DnD API", href: `${base}/dnd-api` },
    { key: "backup", label: "Backup", href: `${base}/backup` },
    { key: "new-page", label: "Neue Seite", href: `${base}/pages/new` },
  ];

  return items.map((item) => ({
    ...item,
    active: item.key === active,
  }));
}

/** Map world nav key to mobile bottom nav active tab. */
export function worldBottomNavKey(active: WorldNavKey, isSearching = false): WorldBottomNavKey {
  if (isSearching) return "search";
  if (active === "overview") return "overview";
  if (active === "pages" || active === "new-page") return "pages";
  if (active === "inspector") return "inspector";
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
  if (normalized.startsWith("/capture")) return "capture";
  if (normalized.startsWith("/worlds") || normalized.startsWith("/search")) return "search";
  if (normalized.startsWith("/image-studio")) return "image-studio";
  if (normalized.startsWith("/ai")) return "ai";
  return undefined;
}

/** Resolve active world nav from pathname. */
export function resolveWorldNavKey(pathname: string, worldSlug: string): WorldNavKey {
  const base = `/worlds/${worldSlug}`;
  const normalized = pathname.replace(/\/$/, "");

  if (normalized === `${base}/dashboard`) return "overview";
  if (normalized === base) return "pages";
  const sessionDetailMatch = normalized.match(new RegExp(`^${base}/sessions/([^/]+)$`));
  if (sessionDetailMatch) {
    const segment = sessionDetailMatch[1] ?? "";
    return isLikelyGameSessionId(segment) ? "sessions" : "pages";
  }
  if (normalized.startsWith(`${base}/sessions`)) return "sessions";
  if (normalized.startsWith(`${base}/dungeons`)) return "dungeons";
  if (normalized.startsWith(`${base}/assets`)) return "assets";
  if (normalized.startsWith(`${base}/labels`)) return "labels";
  if (normalized.startsWith(`${base}/notes`)) return "notes";
  if (normalized.startsWith(`${base}/soundboard`)) return "soundboard";
  if (normalized.startsWith(`${base}/graph`)) return "graph";
  if (normalized.startsWith(`${base}/inspector`)) return "inspector";
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

/** Command-palette entries derived from canonical Studio IA (studio-navigation). */
export function studioCommandPaletteCommands(options: {
  worlds: { name: string; slug: string }[];
  worldSlug?: string | null;
  pathname?: string;
}): StudioPaletteCommand[] {
  const { worlds, worldSlug, pathname = "" } = options;
  const list: StudioPaletteCommand[] = [];

  if (worldSlug) {
    const base = `/worlds/${worldSlug}`;
    const world = worlds.find((entry) => entry.slug === worldSlug);
    const group = world ? `Welt: ${world.name}` : "Aktuelle Welt";

    for (const item of worldNavItems(worldSlug)) {
      const keywords =
        item.key === "overview"
          ? ["dashboard", "overview"]
          : item.key === "pages"
            ? ["wiki", "seitenliste"]
            : item.key === "inspector"
              ? ["sicherheit", "kanon", "leak", "check"]
              : item.key === "graph"
                ? ["beziehungen", "links"]
                : item.key === "assets"
                  ? ["karten", "bilder", "uploads"]
                  : item.key === "soundboard"
                    ? ["musik", "audio"]
                    : item.key === "notes"
                      ? ["kommentare", "review"]
                      : item.key === "dungeons"
                        ? ["räume", "cockpit"]
                        : item.key === "labels"
                          ? ["druck", "handout", "6x4", "label"]
                          : item.key === "import"
                            ? ["knoteforge"]
                            : item.key === "backup"
                              ? ["sicherung"]
                              : item.key === "new-page"
                                ? ["create", "erstellen"]
                                : item.key === "sessions"
                                  ? ["spielabend", "create"]
                                  : undefined;

      list.push({
        id: `world-${item.key}`,
        label:
          item.key === "overview"
            ? "Übersicht öffnen"
            : item.key === "pages"
              ? "Seitenliste öffnen"
              : item.key === "new-page"
                ? "Neue Seite erstellen"
                : `${item.label} öffnen`,
        href: item.href,
        group,
        keywords,
      });
    }

    for (const shortcut of PAGE_TEMPLATE_SHORTCUTS) {
      list.push({
        id: shortcut.id,
        label: shortcut.label,
        href: `${base}/pages/new?template=${shortcut.template}`,
        group,
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
        group,
        keywords: ["label", "quelle"],
      });
    }
  }

  for (const section of STUDIO_NAV_SECTIONS) {
    for (const item of section.items) {
      list.push({
        id: `studio-${item.href.replace(/[^a-z0-9]+/gi, "-")}`,
        label: `${item.label} öffnen`,
        href: item.href,
        group: section.title,
        keywords: [section.title.toLocaleLowerCase("de")],
      });
    }
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
