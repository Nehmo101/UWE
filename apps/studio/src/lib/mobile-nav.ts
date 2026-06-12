/** Bottom navigation item shape (mirrors @uwe/shared-ui MobileBottomNav). */
export interface StudioBottomNavItem {
  label: string;
  href?: string;
  icon: string;
  active?: boolean;
  action?: "open-sidebar";
}

/** Bottom navigation for global Studio pages (dashboard, worlds list, etc.) */
export function studioGlobalBottomNav(active: "dashboard" | "worlds" | "search" | "settings"): StudioBottomNavItem[] {
  return [
    { label: "Dashboard", href: "/", icon: "⌂", active: active === "dashboard" },
    { label: "Welten", href: "/worlds", icon: "🌍", active: active === "worlds" },
    { label: "Suche", href: "/search", icon: "🔍", active: active === "search" },
    { label: "Einstell.", href: "/settings", icon: "⚙", active: active === "settings" },
    { label: "Mehr", icon: "☰", action: "open-sidebar" },
  ];
}

/** Bottom navigation for world-scoped Studio pages */
export function studioWorldBottomNav(
  worldSlug: string,
  active: "overview" | "pages" | "search" | "inspector" | "more",
): StudioBottomNavItem[] {
  const base = `/worlds/${worldSlug}`;
  return [
    { label: "Übersicht", href: `${base}/dashboard`, icon: "⌂", active: active === "overview" },
    { label: "Seiten", href: base, icon: "📄", active: active === "pages" },
    { label: "Suche", href: `${base}?q=`, icon: "🔍", active: active === "search" },
    { label: "Inspektor", href: `${base}/inspector`, icon: "🛡", active: active === "inspector" },
    { label: "Mehr", icon: "☰", action: "open-sidebar", active: active === "more" },
  ];
}
