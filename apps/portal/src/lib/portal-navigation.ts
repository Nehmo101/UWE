/** Portal information architecture — player-facing navigation only. */

export type PortalGlobalNavKey = "start" | "worlds" | "discover" | "account" | "help";

export type PortalWorldNavKey =
  | "dashboard"
  | "sessions"
  | "notes"
  | "handouts"
  | "soundboard"
  | "search";

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

/** Top-level Portal navigation (authenticated hub). */
export function portalGlobalNav(active: PortalGlobalNavKey): PortalNavItem[] {
  const items: { key: PortalGlobalNavKey; label: string; href: string }[] = [
    { key: "start", label: "Start", href: "/portal" },
    { key: "worlds", label: "Meine Welten", href: "/auth/worlds" },
    { key: "discover", label: "Welt entdecken", href: "/worlds" },
    { key: "account", label: "Account", href: "/auth/account/password" },
    { key: "help", label: "Hilfe", href: "/" },
  ];

  return items.map((item) => ({
    ...item,
    active: item.key === active,
  }));
}

/** World-scoped player navigation inside /auth/worlds/[slug]. */
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

  return items.map((item) => ({
    ...item,
    active: item.key === active,
  }));
}

/** Account settings navigation. */
export function portalAccountNav(active: PortalAccountNavKey): PortalNavItem[] {
  const items: { key: PortalAccountNavKey; label: string; href: string }[] = [
    { key: "password", label: "Passwort", href: "/auth/account/password" },
    { key: "security", label: "Sicherheit (2FA)", href: "/auth/account/security" },
  ];

  return items.map((item) => ({
    ...item,
    active: item.key === active,
  }));
}

/** Grouped sidebar for authenticated Portal pages. */
export function portalAuthSidebarSections(options: {
  globalActive?: PortalGlobalNavKey;
  worldSlug?: string | null;
  worldActive?: PortalWorldNavKey;
  accountActive?: PortalAccountNavKey;
}): PortalNavSection[] {
  const sections: PortalNavSection[] = [
    { title: "Portal", items: portalGlobalNav(options.globalActive ?? "worlds") },
  ];

  if (options.worldSlug) {
    sections.push({
      title: "Welt",
      items: portalWorldNav(options.worldSlug, options.worldActive),
    });
  }

  sections.push({
    title: "Account",
    items: portalAccountNav(options.accountActive ?? "password"),
  });

  return sections;
}

/** Guest wiki navigation for public /worlds routes. */
export function portalGuestNav(activePath?: string): PortalNavItem[] {
  const items = [
    { key: "discover", label: "Welten entdecken", href: "/worlds" },
    { key: "help", label: "Hilfe", href: "/" },
    { key: "login", label: "Anmelden", href: "/login" },
  ];

  return items.map((item) => ({
    ...item,
    active: activePath === item.href,
  }));
}

/** Breadcrumb trail for world-scoped auth pages. */
export function portalWorldBreadcrumbs(
  worldName: string,
  worldSlug: string,
  current?: string,
): { label: string; href?: string }[] {
  const items: { label: string; href?: string }[] = [
    { label: "Meine Welten", href: "/auth/worlds" },
    { label: worldName, href: `/auth/worlds/${worldSlug}` },
  ];

  if (current) {
    items.push({ label: current });
  }

  return items;
}

/** Resolve active world nav key from pathname. */
export function resolvePortalWorldNavKey(pathname: string, worldSlug: string): PortalWorldNavKey {
  const base = `/auth/worlds/${worldSlug}`;
  if (pathname === base || pathname === `${base}/`) return "dashboard";
  if (pathname.startsWith(`${base}/sessions`)) return "sessions";
  if (pathname.startsWith(`${base}/notes`)) return "notes";
  if (pathname.startsWith(`${base}/assets`)) return "handouts";
  if (pathname.startsWith(`${base}/soundboard`)) return "soundboard";
  return "dashboard";
}
