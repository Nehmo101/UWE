/** Bottom navigation item shape (mirrors @uwe/shared-ui MobileBottomNav). */
export interface StudioBottomNavItem {
  label: string;
  href?: string;
  icon: string;
  active?: boolean;
  action?: "open-sidebar";
}

/** Bottom navigation for global Studio pages (Daily Admin OS) */
export function studioGlobalBottomNav(
  active: "today" | "capture" | "search" | "ai" | "more",
): StudioBottomNavItem[] {
  return [
    { label: "Heute", href: "/today", icon: "☀", active: active === "today" },
    { label: "Capture", href: "/capture", icon: "+", active: active === "capture" },
    { label: "Suche", href: "/search", icon: "🔍", active: active === "search" },
    { label: "KI", href: "/ai", icon: "✦", active: active === "ai" },
    { label: "Mehr", icon: "☰", action: "open-sidebar", active: active === "more" },
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
