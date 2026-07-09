/** Bottom navigation item shape (mirrors @uwe/shared-ui MobileBottomNav). */
export interface StudioBottomNavItem {
  label: string;
  href?: string;
  icon: string;
  active?: boolean;
  action?: "open-sidebar";
}

export type StudioGlobalBottomNavKey =
  | "today"
  | "worlds"
  | "create"
  | "media-ai"
  | "system"
  | "capture"
  | "search"
  | "ai"
  | "more";

export type StudioAdminBottomNavKey = "today" | "capture" | "search" | "ai" | "more";

function normalizeGlobalKey(active: StudioGlobalBottomNavKey) {
  if (active === "capture") return "create";
  if (active === "search") return "worlds";
  if (active === "ai") return "media-ai";
  if (active === "more") return "system";
  return active;
}

/** Bottom navigation for global Studio pages — exactly the five primary areas. */
export function studioGlobalBottomNav(active: StudioGlobalBottomNavKey): StudioBottomNavItem[] {
  const activeKey = normalizeGlobalKey(active);
  return [
    { label: "Heute", href: "/today", icon: "☀", active: activeKey === "today" },
    { label: "Welten", href: "/worlds", icon: "◎", active: activeKey === "worlds" },
    { label: "Erstellen", href: "/capture", icon: "+", active: activeKey === "create" },
    { label: "Medien & KI", href: "/ai", icon: "✦", active: activeKey === "media-ai" },
    { label: "System", href: "/system", icon: "⚙", active: activeKey === "system" },
  ];
}

/** Bottom navigation for Daily Admin OS pages. */
export function studioAdminBottomNav(active: StudioAdminBottomNavKey): StudioBottomNavItem[] {
  return [
    { label: "Heute", href: "/today", icon: "☀", active: active === "today" },
    { label: "Capture", href: "/capture", icon: "+", active: active === "capture" },
    {
      label: "Suche",
      href: "/search?scope=admin",
      icon: "🔍",
      active: active === "search",
    },
    { label: "KI", href: "/life-brain", icon: "✦", active: active === "ai" },
    { label: "Mehr", href: "/system", icon: "☰", active: active === "more" },
  ];
}

const ADMIN_NAV_PREFIXES = [
  "/today",
  "/capture",
  "/projects",
  "/workshop",
  "/contracts",
  "/hardware",
  "/life-brain",
  "/calendar",
  "/mail",
] as const;

function isAdminNavPath(pathname: string): boolean {
  if (pathname === "/search" || pathname.startsWith("/search?")) {
    return true;
  }
  return ADMIN_NAV_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function resolveAdminNavActive(pathname: string): StudioAdminBottomNavKey {
  if (pathname === "/today" || pathname.startsWith("/today/")) {
    return "today";
  }
  if (pathname.startsWith("/capture")) {
    return "capture";
  }
  if (pathname === "/search" || pathname.startsWith("/search")) {
    return "search";
  }
  if (pathname.startsWith("/life-brain")) {
    return "ai";
  }
  return "more";
}

function resolveGlobalNavActive(pathname: string): StudioGlobalBottomNavKey {
  if (pathname === "/today" || pathname.startsWith("/today/")) {
    return "today";
  }
  if (pathname.startsWith("/worlds") || pathname.startsWith("/search")) {
    return "worlds";
  }
  if (pathname.startsWith("/capture")) {
    return "capture";
  }
  if (
    pathname.startsWith("/ai") ||
    pathname.startsWith("/image-studio") ||
    pathname.startsWith("/brain")
  ) {
    return "ai";
  }
  return "system";
}

/** Pick admin or global bottom nav from the current pathname. */
export function resolveStudioBottomNav(pathname: string): StudioBottomNavItem[] {
  if (isAdminNavPath(pathname)) {
    return studioAdminBottomNav(resolveAdminNavActive(pathname));
  }
  return studioGlobalBottomNav(resolveGlobalNavActive(pathname));
}

/** Bottom navigation for world-scoped Studio pages. Secondary areas live in the drawer. */
export function studioWorldBottomNav(
  worldSlug: string,
  active: "overview" | "content" | "sessions" | "tools" | "more",
): StudioBottomNavItem[] {
  const base = `/worlds/${worldSlug}`;
  return [
    { label: "Übersicht", href: `${base}/dashboard`, icon: "⌂", active: active === "overview" },
    { label: "Inhalte", href: `${base}/wiki`, icon: "📄", active: active === "content" },
    { label: "Sessions", href: `${base}/sessions`, icon: "▣", active: active === "sessions" },
    { label: "Tools", href: `${base}/brain`, icon: "⚙", active: active === "tools" },
    { label: "Mehr", icon: "☰", action: "open-sidebar", active: active === "more" },
  ];
}
