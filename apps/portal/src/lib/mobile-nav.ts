/** Bottom navigation item shape (mirrors @uwe/shared-ui MobileBottomNav). */
export interface PortalBottomNavItem {
  label: string;
  href?: string;
  icon: string;
  active?: boolean;
  action?: "open-sidebar";
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
export function portalAuthBottomNav(active: "worlds" | "login"): PortalBottomNavItem[] {
  return [
    { label: "Welten", href: "/auth/worlds", icon: "🌍", active: active === "worlds" },
    { label: "Portal", href: "/worlds", icon: "⌂" },
    { label: "Login", href: "/login", icon: "👤", active: active === "login" },
  ];
}
