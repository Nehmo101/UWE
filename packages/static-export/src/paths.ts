import {
  navCategoryForPageType,
  type NavCategory,
} from "@uwe/database/server";
import type { PageType } from "@uwe/database/server";

/** English URL segments for static export folders. */
export const STATIC_EXPORT_CATEGORIES: Record<NavCategory, string> = {
  lore: "lore",
  orte: "locations",
  npcs: "npcs",
  fraktionen: "factions",
  sessions: "sessions",
  handouts: "handouts",
  karten: "maps",
};

export const STATIC_EXPORT_CATEGORY_LABELS: Record<string, string> = {
  lore: "Lore",
  locations: "Orte",
  npcs: "NPCs",
  factions: "Fraktionen",
  sessions: "Sessions",
  handouts: "Handouts",
  maps: "Karten",
};

export function staticExportCategoryForPageType(type: PageType): string {
  const nav = navCategoryForPageType(type);
  return STATIC_EXPORT_CATEGORIES[nav];
}

export function staticPageDir(category: string, slug: string): string {
  return `${category}/${slug}`;
}

export function staticPageHref(category: string, slug: string): string {
  return `${staticPageDir(category, slug)}/`;
}

export function navCategoryFromPortalSegment(segment: string): NavCategory | null {
  if (segment in STATIC_EXPORT_CATEGORIES) {
    return segment as NavCategory;
  }

  const match = Object.entries(STATIC_EXPORT_CATEGORIES).find(
    ([, exportName]) => exportName === segment,
  );
  return match ? (match[0] as NavCategory) : null;
}

export function portalUrlToStaticHref(portalUrl: string, worldSlug: string): string {
  const pattern = new RegExp(
    `^/worlds/${escapeRegex(worldSlug)}/([^/]+)/([^/]+)/?$`,
  );
  const match = portalUrl.match(pattern);
  if (!match) {
    return portalUrl;
  }

  const [, navSegment, slug] = match;
  const navCategory = navCategoryFromPortalSegment(navSegment);
  const exportCategory = navCategory
    ? STATIC_EXPORT_CATEGORIES[navCategory]
    : navSegment;

  return staticPageHref(exportCategory, slug);
}

export function relativeHref(fromDir: string, targetHref: string): string {
  if (!targetHref || targetHref.startsWith("http") || targetHref.startsWith("#")) {
    return targetHref;
  }

  const hasTrailingSlash = targetHref.endsWith("/");
  const normalizedTarget = targetHref.replace(/^\.\//, "").replace(/\/$/, "");
  const fromParts = fromDir ? fromDir.split("/").filter(Boolean) : [];
  const targetParts = normalizedTarget.split("/").filter(Boolean);

  if (targetParts.length === 0) {
    return hasTrailingSlash ? "./" : "./";
  }

  let common = 0;
  while (
    common < fromParts.length &&
    common < targetParts.length &&
    fromParts[common] === targetParts[common]
  ) {
    common += 1;
  }

  const up = fromParts.length - common;
  const down = targetParts.slice(common);
  const prefix = up === 0 ? "./" : "../".repeat(up);
  const result = down.length === 0 ? prefix : `${prefix}${down.join("/")}`;

  return hasTrailingSlash ? `${result.replace(/\/$/, "")}/` : result;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
