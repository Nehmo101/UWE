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

/** Bottom navigation for world-scoped Studio pages. Secondary areas live in the drawer. */
export function studioWorldBottomNav(
  worldSlug: string,
  active: "overview" | "content" | "sessions" | "tools" | "more",
): StudioBottomNavItem[] {
  const base = `/worlds/${worldSlug}`;
  return [
    { label: "Übersicht", href: `${base}/dashboard`, icon: "⌂", active: active === "overview" },
    { label: "Inhalte", href: base, icon: "📄", active: active === "content" },
    { label: "Sessions", href: `${base}/sessions`, icon: "▣", active: active === "sessions" },
    { label: "Tools", href: `${base}/brain`, icon: "⚙", active: active === "tools" },
    { label: "Mehr", icon: "☰", action: "open-sidebar", active: active === "more" },
  ];
}
