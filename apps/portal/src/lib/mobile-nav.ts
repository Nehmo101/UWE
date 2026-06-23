/** Bottom navigation item shape (mirrors @uwe/shared-ui MobileBottomNav). */
export interface PortalBottomNavItem {
  label: string;
  href?: string;
  icon: string;
  active?: boolean;
  action?: "open-sidebar";
}

/** Bottom navigation for public world discovery (/worlds). */
export function portalDiscoverBottomNav(
  active: "discover" | "login" | "more",
): PortalBottomNavItem[] {
  return [
    { label: "Welten", href: "/worlds", icon: "🌍", active: active === "discover" },
    { label: "Meine", href: "/auth/worlds", icon: "⌂" },
    { label: "Anmelden", href: "/login", icon: "👤", active: active === "login" },
    { label: "Menü", icon: "☰", action: "open-sidebar", active: active === "more" },
  ];
}

/** Bottom navigation for public Portal world pages */
export function portalWorldBottomNav(
  worldSlug: string,
  active: "home" | "search" | "graph" | "more",
): PortalBottomNavItem[] {
  const base = `/worlds/${worldSlug}`;
  return [
    { label: "Start", href: base, icon: "⌂", active: active === "home" },
    { label: "Suche", href: `${base}#search`, icon: "🔍", active: active === "search" },
    { label: "Graph", href: `${base}/graph`, icon: "🔗", active: active === "graph" },
    { label: "Welten", href: "/worlds", icon: "🌍" },
    { label: "Menü", icon: "☰", action: "open-sidebar", active: active === "more" },
  ];
}

/** Bottom navigation for authenticated Portal pages */
export function portalAuthBottomNav(
  worldSlug: string | null,
  active: "worlds" | "dashboard" | "sessions" | "handouts" | "account" | "more",
): PortalBottomNavItem[] {
  const worldBase = worldSlug ? `/auth/worlds/${worldSlug}` : null;
  return [
    { label: "Welten", href: "/auth/worlds", icon: "🌍", active: active === "worlds" },
    ...(worldBase
      ? [
          { label: "Start", href: worldBase, icon: "⌂", active: active === "dashboard" },
          {
            label: "Sessions",
            href: `${worldBase}/sessions`,
            icon: "📜",
            active: active === "sessions",
          },
          {
            label: "Handouts",
            href: `${worldBase}/assets`,
            icon: "🎨",
            active: active === "handouts",
          },
        ]
      : []),
    {
      label: "Account",
      href: "/auth/account/password",
      icon: "👤",
      active: active === "account",
    },
    ...(worldBase
      ? [{ label: "Mehr", icon: "☰", action: "open-sidebar" as const, active: active === "more" }]
      : []),
  ];
}
