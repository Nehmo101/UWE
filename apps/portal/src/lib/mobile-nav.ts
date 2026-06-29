export interface PortalBottomNavItem {
  label: string;
  href?: string;
  icon: string;
  active?: boolean;
  action?: "open-sidebar";
}

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
