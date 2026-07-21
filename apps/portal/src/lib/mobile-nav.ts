export interface PortalBottomNavItem {
  label: string;
  href?: string;
  icon: string;
  active?: boolean;
  action?: "open-sidebar";
}

export type PortalAuthBottomNavActive =
  | "worlds"
  | "dashboard"
  | "wiki"
  | "characters"
  | "quests"
  | "account"
  | "more";

/**
 * Thumb-zone IA (final): inside a world the bar carries the four primary
 * player destinations — Start (dashboard), Wiki, Charaktere, Questlog — plus
 * "Mehr" (opens the drawer with the full world nav: Sessions, Handouts,
 * Timeline, Graph, Notizen, Atlas, …). The graph stays in the drawer: it is an
 * exploration tool, not a per-session target, and five slots is the thumb-zone
 * budget. Outside a world scope the bar anchors on Welten + Account.
 */
export function portalAuthBottomNav(
  worldSlug: string | null,
  active: PortalAuthBottomNavActive,
): PortalBottomNavItem[] {
  const worldBase = worldSlug ? `/auth/worlds/${worldSlug}` : null;

  if (!worldBase) {
    return [
      { label: "Welten", href: "/auth/worlds", icon: "🌍", active: active === "worlds" },
      { label: "Account", href: "/auth/account/password", icon: "👤", active: active === "account" },
    ];
  }

  return [
    { label: "Start", href: worldBase, icon: "⌂", active: active === "dashboard" },
    { label: "Wiki", href: `${worldBase}/wiki`, icon: "📖", active: active === "wiki" },
    { label: "Charaktere", href: `${worldBase}/characters`, icon: "🧙", active: active === "characters" },
    { label: "Quests", href: `${worldBase}/quests`, icon: "📜", active: active === "quests" },
    { label: "Mehr", icon: "☰", action: "open-sidebar" as const, active: active === "more" },
  ];
}

/** World sections that get their own bottom-nav tab. */
const WORLD_TAB_SECTIONS: Record<string, PortalAuthBottomNavActive> = {
  wiki: "wiki",
  characters: "characters",
  quests: "quests",
};

/** World sections reachable via the "Mehr" drawer (no dedicated tab). */
const WORLD_DRAWER_SECTIONS = new Set([
  "sessions",
  "assets",
  "notes",
  "npcs",
  "graph",
  "timeline",
  "treasury",
  "soundboard",
  "atlas3d",
]);

/** Resolve bottom-nav active tab from the current authenticated portal pathname. */
export function resolvePortalAuthBottomNav(
  pathname: string,
  worldSlug: string | null,
): PortalBottomNavItem[] {
  if (pathname.startsWith("/auth/account")) {
    return portalAuthBottomNav(null, "account");
  }

  if (!worldSlug) {
    return portalAuthBottomNav(null, "worlds");
  }

  const base = `/auth/worlds/${worldSlug}`;
  const path = pathname.split("?")[0]!;

  if (path === base) {
    return portalAuthBottomNav(worldSlug, "dashboard");
  }
  if (!path.startsWith(`${base}/`)) {
    return portalAuthBottomNav(worldSlug, "more");
  }

  const section = path.slice(base.length + 1).split("/")[0]!;
  const tab = WORLD_TAB_SECTIONS[section];
  if (tab) {
    return portalAuthBottomNav(worldSlug, tab);
  }
  if (WORLD_DRAWER_SECTIONS.has(section)) {
    return portalAuthBottomNav(worldSlug, "more");
  }

  // Anything else directly under the world base is a wiki article detail
  // (catch-all [slug] route) — keep the Wiki tab active for orientation.
  return portalAuthBottomNav(worldSlug, "wiki");
}
