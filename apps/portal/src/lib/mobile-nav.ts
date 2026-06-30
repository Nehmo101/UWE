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
  | "sessions"
  | "handouts"
  | "account"
  | "more";

export function portalAuthBottomNav(
  worldSlug: string | null,
  active: PortalAuthBottomNavActive,
): PortalBottomNavItem[] {
  const worldBase = worldSlug ? `/auth/worlds/${worldSlug}` : null;
  return [
    { label: "Welten", href: "/auth/worlds", icon: "🌍", active: active === "worlds" },
    ...(worldBase
      ? [
          { label: "Start", href: worldBase, icon: "⌂", active: active === "dashboard" },
          { label: "Sessions", href: `${worldBase}/sessions`, icon: "📜", active: active === "sessions" },
          { label: "Handouts", href: `${worldBase}/assets`, icon: "🎨", active: active === "handouts" },
        ]
      : []),
    { label: "Account", href: "/auth/account/password", icon: "👤", active: active === "account" },
    ...(worldBase
      ? [{ label: "Mehr", icon: "☰", action: "open-sidebar" as const, active: active === "more" }]
      : []),
  ];
}

/** Resolve bottom-nav active tab from the current authenticated portal pathname. */
export function resolvePortalAuthBottomNav(
  pathname: string,
  worldSlug: string | null,
): PortalBottomNavItem[] {
  if (pathname.startsWith("/auth/account")) {
    return portalAuthBottomNav(worldSlug, "account");
  }

  if (!worldSlug) {
    return portalAuthBottomNav(null, "worlds");
  }

  const base = `/auth/worlds/${worldSlug}`;
  const path = pathname.split("?")[0]!;

  if (path === base) {
    return portalAuthBottomNav(worldSlug, "dashboard");
  }
  if (path.startsWith(`${base}/sessions`)) {
    return portalAuthBottomNav(worldSlug, "sessions");
  }
  if (path.startsWith(`${base}/assets`)) {
    return portalAuthBottomNav(worldSlug, "handouts");
  }

  return portalAuthBottomNav(worldSlug, "more");
}
