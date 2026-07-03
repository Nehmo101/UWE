import { STUDIO_SESSION_ENTRY_PATH } from "@uwe/auth";

export interface GlobalNavItem {
  label: string;
  href: string;
  active?: boolean;
}

/** Compact global navigation — stable across world subpages. */
export function globalNavItems(activePath?: string): GlobalNavItem[] {
  const items: GlobalNavItem[] = [
    { label: "Dashboard", href: STUDIO_SESSION_ENTRY_PATH },
    { label: "Welten", href: "/worlds" },
    { label: "Admin", href: "/admin" },
    { label: "Einstellungen", href: "/settings" },
  ];

  if (!activePath) return items;

  return items.map((item) => ({
    ...item,
    active: item.href === activePath,
  }));
}
