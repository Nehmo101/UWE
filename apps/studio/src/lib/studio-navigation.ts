/** Studio information architecture — DM, creator, owner, and admin navigation. */

export type StudioNavSectionId =
  | "dashboard"
  | "worlds"
  | "daily-admin"
  | "content"
  | "ai"
  | "integrations"
  | "users"
  | "admin"
  | "setup"
  | "system"
  | "backup"
  | "settings";

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
      id: "dashboard",
      title: "Dashboard",
      items: [
        { label: "Studio Dashboard", href: "/studio" },
        { label: "Heute", href: "/today" },
      ],
    },
    {
      id: "worlds",
      title: "Welten & Kampagnen",
      items: [
        { label: "Welten", href: "/worlds" },
        { label: "Globale Suche", href: "/search" },
        { label: "Brain Store", href: "/brain" },
        { label: "Templates", href: "/templates" },
      ],
    },
    {
      id: "daily-admin",
      title: "Daily Admin OS",
      items: [
        { label: "Capture", href: "/capture" },
        { label: "Projekte", href: "/projects" },
        { label: "Werkstatt", href: "/workshop" },
        { label: "Verträge", href: "/contracts" },
        { label: "Hardware", href: "/hardware" },
        { label: "Persönliches Brain", href: "/life-brain" },
      ],
    },
    {
      id: "content",
      title: "Inhalte & Medien",
      items: [
        { label: "Image Studio", href: "/image-studio" },
        { label: "Mail Center", href: "/mail" },
        { label: "Kalender", href: "/calendar" },
      ],
    },
    {
      id: "ai",
      title: "KI-Werkzeuge",
      items: [
        { label: "KI-Chat", href: "/ai" },
        { label: "KI-Prompt", href: "/admin/ai-prompt" },
        { label: "KI-Gateway", href: "/admin/ai-gateway" },
        { label: "Reviews", href: "/admin/reviews" },
        { label: "Agent Jobs", href: "/admin/agent-jobs" },
      ],
    },
    {
      id: "integrations",
      title: "Integrationen",
      items: [{ label: "Einstellungen → Integrationen", href: "/settings?tab=integrations" }],
    },
    {
      id: "users",
      title: "Benutzer & Rollen",
      items: [
        { label: "Benutzer", href: "/admin/users" },
        { label: "API Tokens", href: "/admin/api-tokens" },
        { label: "Webhooks", href: "/admin/webhooks" },
      ],
    },
    {
      id: "admin",
      title: "Admin",
      items: [
        { label: "Admin Übersicht", href: "/admin" },
        { label: "Mail Portal", href: "/admin/mail" },
        { label: "Security", href: "/admin/security" },
        { label: "Audit Log", href: "/admin/audit-log" },
        { label: "Tags", href: "/admin/tags" },
        { label: "Cookbook", href: "/admin/cookbook" },
      ],
    },
    {
      id: "setup",
      title: "Einrichtung",
      items: [
        { label: "Initial Setup", href: "/setup" },
        { label: "Cookbook", href: "/admin/cookbook" },
        { label: "KI-Gateway", href: "/admin/ai-gateway" },
      ],
    },
    {
      id: "system",
      title: "System & Diagnose",
      items: [
        { label: "Systemstatus", href: "/admin/status" },
        { label: "Jobs", href: "/jobs" },
        { label: "Einstellungen → Status", href: "/settings?tab=status" },
      ],
    },
    {
      id: "backup",
      title: "Backup & Restore",
      items: [{ label: "Backup", href: "/backup" }],
    },
    {
      id: "settings",
      title: "Einstellungen",
      items: [
        { label: "Einstellungen", href: "/settings" },
        { label: "Passwort ändern", href: "/account/password" },
        { label: "Sicherheit (2FA)", href: "/account/security" },
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
    "/studio",
    "/worlds",
    "/admin",
    "/today",
    "/capture",
    "/search",
    "/ai",
    "/brain",
    "/image-studio",
    "/backup",
    "/admin/status",
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

  // Prefix match for nested routes (e.g. /worlds/terra/... → /worlds)
  if (
    normalizedHref !== "/studio" &&
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

import { isLikelyGameSessionId } from "./session-route";

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
