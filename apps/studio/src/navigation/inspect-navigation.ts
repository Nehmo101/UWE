/**
 * Navigation health inspection (server-only).
 *
 * Compares the central navigation contract against the actual Next.js route
 * tree on disk and reports dead links, planned items that now have a route,
 * routes that are not reachable from navigation, and duplicate ids/hrefs/labels.
 * Powers the System → Navigation overview (Phase 7) and is unit-tested.
 *
 * Uses node:fs and must only be imported from server components / scripts.
 */
import { existsSync, readdirSync, type Dirent } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findNavConflicts, normalizeNavPath, type NavConflicts, type NavItem } from "./types";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const STUDIO_APP_DIR = join(MODULE_DIR, "../../app");

/**
 * Collect normalized route patterns from a Next.js `app` directory.
 * - excludes `/api` routes
 * - drops route groups `(group)`
 * - keeps dynamic segments as `[param]`
 */
export function collectAppRoutePatterns(appDir: string = STUDIO_APP_DIR): string[] {
  const patterns = new Set<string>();

  function walk(dir: string, segments: string[]): void {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    if (entries.some((entry) => entry.isFile() && /^page\.(t|j)sx?$/.test(entry.name))) {
      const path = `/${segments.join("/")}`.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
      patterns.add(path);
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (name === "api" && segments.length === 0) continue; // skip API routes
      // Route groups like (hub) do not affect the URL.
      const isGroup = name.startsWith("(") && name.endsWith(")");
      const nextSegments = isGroup ? segments : [...segments, name];
      walk(join(dir, name), nextSegments);
    }
  }

  walk(appDir, []);
  return [...patterns].sort();
}

/** Match a concrete pathname against a route pattern (with `[param]` wildcards). */
export function matchesRoutePattern(pathname: string, pattern: string): boolean {
  const pathParts = normalizeNavPath(pathname).split("?")[0]!.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) return false;
  return patternParts.every((part, index) => {
    if (part.startsWith("[") && part.endsWith("]")) return Boolean(pathParts[index]);
    return part === pathParts[index];
  });
}

function navPathname(item: NavItem): string {
  return normalizeNavPath(item.href).split("?")[0]!;
}

function routeMatches(pathname: string, routePatterns: string[]): boolean {
  return routePatterns.some((pattern) => matchesRoutePattern(pathname, pattern));
}

export interface NavAuditEntry {
  id: string;
  label: string;
  href: string;
  section: string;
  status: NavItem["status"];
  source: NavItem["source"];
}

export interface NavAudit {
  /** Active items whose route does not exist on disk. */
  deadLinks: NavAuditEntry[];
  /** Planned items whose route already exists (candidate to flip to active). */
  promotable: NavAuditEntry[];
  /** Route patterns with no navigation entry (excludes dynamic and detail routes). */
  routesWithoutNav: string[];
  conflicts: NavConflicts;
}

function toEntry(item: NavItem): NavAuditEntry {
  return {
    id: item.id,
    label: item.label,
    href: item.href,
    section: item.section,
    status: item.status,
    source: item.source,
  };
}

/**
 * Audit navigation items against a set of route patterns.
 * Pure (no fs) so it can be unit-tested with synthetic inputs.
 */
export function auditNavigation(items: NavItem[], routePatterns: string[]): NavAudit {
  const deadLinks: NavAuditEntry[] = [];
  const promotable: NavAuditEntry[] = [];
  const referenced = new Set<string>();

  for (const item of items) {
    if (item.external) continue;
    const pathname = navPathname(item);
    const exists = routeMatches(pathname, routePatterns);

    for (const pattern of routePatterns) {
      if (matchesRoutePattern(pathname, pattern)) referenced.add(pattern);
    }

    if (item.status === "active" && !exists) {
      deadLinks.push(toEntry(item));
    }
    if (item.status === "planned" && exists) {
      promotable.push(toEntry(item));
    }
  }

  const routesWithoutNav = routePatterns
    .filter((pattern) => !referenced.has(pattern))
    // Dynamic/detail routes are not expected to be top-level nav targets.
    .filter((pattern) => !pattern.includes("["));

  return {
    deadLinks,
    promotable,
    routesWithoutNav,
    conflicts: findNavConflicts(items),
  };
}

/** Convenience: audit a nav set against the Studio app route tree on disk. */
export function auditStudioNavigation(items: NavItem[], appDir: string = STUDIO_APP_DIR): NavAudit {
  const patterns = existsSync(appDir) ? collectAppRoutePatterns(appDir) : [];

  // In a production bundle the app source tree may be absent. Without route
  // data we cannot judge dead links, so we degrade to conflict-only checks
  // rather than falsely flagging every active item as broken.
  if (patterns.length === 0) {
    return {
      deadLinks: [],
      promotable: [],
      routesWithoutNav: [],
      conflicts: findNavConflicts(items),
    };
  }

  return auditNavigation(items, patterns);
}
