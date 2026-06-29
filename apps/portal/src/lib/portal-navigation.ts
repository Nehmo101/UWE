/** Portal information architecture — login-first, player-facing navigation only. */

export type PortalGlobalNavKey = "start" | "worlds" | "account";
export type PortalPublicNavKey = "my-worlds" | "login";
export type PortalWorldNavKey = "dashboard" | "sessions" | "notes" | "handouts" | "soundboard" | "search";
export type PortalAccountNavKey = "password" | "security";

export interface PortalNavItem {
  key: string;
  label: string;
  href: string;
  active?: boolean;
}

export interface PortalNavSection {
  title: string;
  items: PortalNavItem[];
}

export function portalGlobalNav(active: PortalGlobalNavKey): PortalNavItem[] {
  const items: { key: PortalGlobalNavKey; label: string; href: string }[] = [
    { key: "start", label: "Start", href: "/auth/worlds" },
    { key: "worlds", label: "Meine Welten", href: "/auth/worlds" },
    { key: "account", label: "Account", href: "/auth/account/password" },
  ];
  return items.map((item) => ({ ...item, active: item.key === active }));
}

export function portalPublicNav(active?: PortalPublicNavKey): PortalNavItem[] {
  const items: { key: PortalPublicNavKey; label: string; href: string }[] = [
    { key: "my-worlds", label: "Meine Welten", href: "/auth/worlds" },
    { key: "login", label: "Anmelden", href: "/login" },
  ];
  return items.map((item) => ({ ...item, active: item.key === active }));
}

export function portalWorldNav(worldSlug: string, active?: PortalWorldNavKey): PortalNavItem[] {
  const base = `/auth/worlds/${worldSlug}`;
  const items: { key: PortalWorldNavKey; label: string; href: string }[] = [
    { key: "dashboard", label: "Übersicht", href: base },
    { key: "sessions", label: "Sessions", href: `${base}/sessions` },
    { key: "notes", label: "Spielernotizen", href: `${base}/notes` },
    { key: "handouts", label: "Handouts", href: `${base}/assets` },
    { key: "soundboard", label: "Soundboard", href: `${base}/soundboard` },
    { key: "search", label: "Suche", href: `${base}?q=` },
  ];
  return items.map((item) => ({ ...item, active: item.key === active }));
}

export function portalAccountNav(active: PortalAccountNavKey): PortalNavItem[] {
  const items: { key: PortalAccountNavKey; label: string; href: string }[] = [
    { key: "password", label: "Passwort", href: "/auth/account/password" },
    { key: "security", label: "Sicherheit (2FA)", href: "/auth/account/security" },
  ];
  return items.map((item) => ({ ...item, active: item.key === active }));
}

export function portalAuthSidebarSections(options: {
  globalActive?: PortalGlobalNavKey;
  worldSlug?: string | null;
  worldActive?: PortalWorldNavKey;
  accountActive?: PortalAccountNavKey;
  includeAccount?: boolean;
}): PortalNavSection[] {
  const sections: PortalNavSection[] = [
    { title: "Portal", items: portalGlobalNav(options.globalActive ?? "worlds") },
  ];
  if (options.worldSlug) {
    sections.push({ title: "Welt", items: portalWorldNav(options.worldSlug, options.worldActive) });
  }
  if (options.includeAccount) {
    sections.push({
      title: "Account",
      items: portalAccountNav(options.accountActive ?? "password"),
    });
  }
  return sections;
}

export function portalPublicSidebarSections(options: {
  active?: PortalPublicNavKey;
  worldSlug?: string | null;
  worldItems?: PortalNavItem[];
}): PortalNavSection[] {
  const sections: PortalNavSection[] = [
    { title: "Portal", items: portalPublicNav(options.active ?? "login") },
  ];
  if (options.worldSlug && options.worldItems && options.worldItems.length > 0) {
    sections.push({ title: "In dieser Welt", items: options.worldItems });
  }
  return sections;
}

export function portalGuestNav(activePath?: string): PortalNavItem[] {
  const items = [
    { key: "login", label: "Anmelden", href: "/login" },
    { key: "worlds", label: "Meine Welten", href: "/auth/worlds" },
    { key: "help", label: "Hilfe", href: "/" },
  ];
  return items.map((item) => ({ ...item, active: activePath === item.href }));
}

export function portalWorldBreadcrumbs(
  worldName: string,
  worldSlug: string,
  current?: string,
): { label: string; href?: string }[] {
  const items: { label: string; href?: string }[] = [
    { label: "Meine Welten", href: "/auth/worlds" },
    { label: worldName, href: `/auth/worlds/${worldSlug}` },
  ];
  if (current) items.push({ label: current });
  return items;
}

export function resolvePortalWorldNavKey(pathname: string, worldSlug: string): PortalWorldNavKey {
  const base = `/auth/worlds/${worldSlug}`;
  if (pathname === base || pathname === `${base}/`) return "dashboard";
  if (pathname.startsWith(`${base}/sessions`)) return "sessions";
  if (pathname.startsWith(`${base}/notes`)) return "notes";
  if (pathname.startsWith(`${base}/assets`)) return "handouts";
  if (pathname.startsWith(`${base}/soundboard`)) return "soundboard";
  return "dashboard";
}
