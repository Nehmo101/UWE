import type { PageType } from "./generated/prisma/client";

/** URL navigation segments for player portal and studio. */
export type NavCategory =
  | "lore"
  | "orte"
  | "npcs"
  | "fraktionen"
  | "sessions"
  | "handouts"
  | "karten";

export const NAV_CATEGORY_LABELS: Record<NavCategory, string> = {
  lore: "Lore",
  orte: "Orte",
  npcs: "NPCs",
  fraktionen: "Fraktionen",
  sessions: "Sessions",
  handouts: "Handouts",
  karten: "Karten",
};

export const NAV_CATEGORIES: NavCategory[] = [
  "lore",
  "orte",
  "npcs",
  "fraktionen",
  "sessions",
  "handouts",
  "karten",
];

const PAGE_TYPE_TO_NAV: Record<PageType, NavCategory> = {
  lore: "lore",
  rule: "lore",
  note: "lore",
  quest: "lore",
  location: "orte",
  region: "orte",
  dungeon: "orte",
  dungeon_level: "orte",
  room: "orte",
  encounter: "sessions",
  npc: "npcs",
  player_character: "npcs",
  monster: "npcs",
  faction: "fraktionen",
  session: "sessions",
  handout: "handouts",
  item: "handouts",
  map: "karten",
  sound: "karten",
};

export function navCategoryForPageType(type: PageType): NavCategory {
  return PAGE_TYPE_TO_NAV[type];
}

export function pageTypesForNavCategory(nav: NavCategory): PageType[] {
  return (Object.entries(PAGE_TYPE_TO_NAV) as [PageType, NavCategory][])
    .filter(([, category]) => category === nav)
    .map(([type]) => type);
}

export function buildPageUrl(
  worldSlug: string,
  type: PageType,
  pageSlug: string,
): string {
  const category = navCategoryForPageType(type);
  return `/worlds/${worldSlug}/${category}/${pageSlug}`;
}

/** Legacy category mapping for backward compatibility with Phase 1 routes. */
export type LegacyPageCategory = "lore" | "locations" | "npcs" | "dungeons";

export function legacyCategoryFromNav(nav: NavCategory): LegacyPageCategory {
  switch (nav) {
    case "orte":
      return "locations";
    case "npcs":
      return "npcs";
    case "fraktionen":
    case "sessions":
    case "handouts":
    case "karten":
      return "lore";
    default:
      return "lore";
  }
}
