/** Bottom navigation item shape (mirrors @uwe/shared-ui MobileBottomNav). */
export interface StudioBottomNavItem {
  label: string;
  href?: string;
  icon: string;
  active?: boolean;
  action?: "open-sidebar";
}

export type StudioGlobalBottomNavKey =
  | "worlds"
  | "media-ai"
  | "system"
  | "search"
  | "ai"
  | "more";

function normalizeGlobalKey(active: StudioGlobalBottomNavKey) {
  // „Medien & KI" gibt es global nicht mehr — KI, Brain und Medien liegen in
  // der Welt. Die alten Schlüssel landen auf der Welten-Liste, statt auf einen
  // Tab zu zeigen, den es nicht mehr gibt.
  if (active === "ai" || active === "media-ai") return "worlds";
  if (active === "more") return "system";
  return active;
}

/**
 * Bottom navigation for global Studio pages.
 *
 * Es gibt nur noch diese eine Variante: die zweite war die des Daily Admin OS,
 * und das liegt in Brain (Abschnitt H1). Studio startet auf der Welten-Liste.
 *
 * Die drei Einträge sind genau die drei Bereiche der Studio-IA (Start, Welten,
 * System) — `mobile-nav.test.ts` hält sie dagegen.
 */
export function studioGlobalBottomNav(active: StudioGlobalBottomNavKey): StudioBottomNavItem[] {
  const activeKey = normalizeGlobalKey(active);
  return [
    { label: "Welten", href: "/worlds", icon: "◎", active: activeKey === "worlds" },
    { label: "Suche", href: "/search", icon: "🔍", active: activeKey === "search" },
    { label: "Konto", href: "/account/password", icon: "⚙", active: activeKey === "system" },
  ];
}

function resolveGlobalNavActive(pathname: string): StudioGlobalBottomNavKey {
  if (pathname.startsWith("/search")) {
    return "search";
  }
  if (pathname.startsWith("/worlds")) {
    return "worlds";
  }
  if (
    pathname.startsWith("/account") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/command") ||
    pathname.startsWith("/settings")
  ) {
    return "system";
  }
  return "worlds";
}

/** Bottom nav for the current pathname. */
export function resolveStudioBottomNav(pathname: string): StudioBottomNavItem[] {
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
