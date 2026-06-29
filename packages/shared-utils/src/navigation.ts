/**
 * Central navigation contract for UWE.
 *
 * This is the single declarative source of truth that feeds the Sidebar,
 * Mobile nav, Breadcrumbs, Command palette, the System → Navigation overview,
 * and navigation tests. Navigation data must stay framework-agnostic: `icon`
 * holds a Lucide icon name (string), resolved to a component at render time so
 * these modules carry no React/Lucide import and can be unit-tested directly.
 */

export type NavStatus = "active" | "legacy-ui-disconnected" | "planned" | "hidden";

export type NavPermission = "owner" | "admin" | "dm" | "player" | "readonly" | "public";

export type NavSource = "studio" | "world" | "system" | "organization" | "portal" | "connector";

export interface NavItem {
  /** Stable unique id within its source. */
  id: string;
  label: string;
  /** App-relative route (or absolute URL when `external` is true). */
  href: string;
  /** Lucide icon name (kebab-case), resolved to a component at render time. */
  icon: string;
  /** Sub-group title within a section (for visual grouping). */
  group: string;
  /** Top-level IA section title. */
  section: string;
  permission: NavPermission[];
  status: NavStatus;
  source: NavSource;
  keywords?: string[];
  external?: boolean;
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

/** Navigation item enriched with an `active` flag for rendering. */
export interface ResolvedNavItem extends NavItem {
  active: boolean;
}

export interface ResolvedNavGroup {
  id: string;
  title: string;
  items: ResolvedNavItem[];
}

/** Command palette entry derived from navigation. */
export interface NavCommand {
  id: string;
  label: string;
  href: string;
  group: string;
  icon: string;
  keywords: string[];
  external?: boolean;
}

/** Normalize a path for comparison: drop hash, collapse slashes, strip trailing slash. */
export function normalizeNavPath(path: string): string {
  if (!path) return "/";
  const [rawPath, query] = path.split("#")[0]!.split("?");
  const trimmed = (rawPath ?? "/").replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  return query ? `${trimmed}?${query}` : trimmed;
}

/**
 * Active-state matcher.
 * - exact match wins
 * - `?tab=` hrefs match the same tab
 * - non-query hrefs match nested child routes (prefix + "/")
 */
export function isNavItemActive(activePath: string, href: string): boolean {
  if (href.startsWith("http")) return false;

  const active = normalizeNavPath(activePath);
  const target = normalizeNavPath(href);

  if (active === target) return true;

  if (target.includes("?tab=")) {
    return active === target;
  }

  if (!target.includes("?") && active.startsWith(`${target}/`)) {
    return true;
  }

  return false;
}

/** Flatten groups to a single item list. */
export function flattenNavGroups(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((group) => group.items);
}

/** Resolve active flags across groups for a given active path. */
export function resolveNavGroups(groups: NavGroup[], activePath: string): ResolvedNavGroup[] {
  return groups.map((group) => ({
    id: group.id,
    title: group.title,
    items: group.items.map((item) => ({
      ...item,
      active: isNavItemActive(activePath, item.href),
    })),
  }));
}

/** Build command-palette entries from navigation groups (skips hidden items). */
export function navGroupsToCommands(groups: NavGroup[]): NavCommand[] {
  return flattenNavGroups(groups)
    .filter((item) => item.status !== "hidden")
    .map((item) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      group: `${item.section} / ${item.group}`,
      icon: item.icon,
      keywords: item.keywords ?? [],
      external: item.external,
    }));
}

export interface NavConflicts {
  duplicateIds: string[];
  duplicateHrefs: string[];
  duplicateLabels: string[];
}

/** Detect duplicate ids / hrefs / labels across a flat item list (for the Navigation overview + tests). */
export function findNavConflicts(items: NavItem[]): NavConflicts {
  const seenIds = new Map<string, number>();
  const seenHrefs = new Map<string, number>();
  const seenLabels = new Map<string, number>();

  for (const item of items) {
    seenIds.set(item.id, (seenIds.get(item.id) ?? 0) + 1);
    // Internal, non-tab hrefs should be unique targets; query/tab hrefs may legitimately repeat a base.
    if (!item.external) {
      seenHrefs.set(item.href, (seenHrefs.get(item.href) ?? 0) + 1);
    }
    seenLabels.set(`${item.section}:${item.label}`, (seenLabels.get(`${item.section}:${item.label}`) ?? 0) + 1);
  }

  const collect = (map: Map<string, number>) =>
    [...map.entries()].filter(([, count]) => count > 1).map(([key]) => key);

  return {
    duplicateIds: collect(seenIds),
    duplicateHrefs: collect(seenHrefs),
    duplicateLabels: collect(seenLabels),
  };
}
