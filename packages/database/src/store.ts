import { SEED_PAGES, SEED_WORLDS } from "./seed";
import type { Page, PageCategory, World } from "./types";

export interface WikiStore {
  worlds: Map<string, World>;
  pages: Map<string, Page>;
}

function indexWorlds(worlds: World[]): Map<string, World> {
  const map = new Map<string, World>();
  for (const world of worlds) {
    map.set(world.id, world);
  }
  return map;
}

function indexPages(pages: Page[]): Map<string, Page> {
  const map = new Map<string, Page>();
  for (const page of pages) {
    map.set(page.id, page);
  }
  return map;
}

/** In-memory wiki store — replaceable with Prisma in Phase 2. */
export function createWikiStore(
  worlds: World[] = SEED_WORLDS,
  pages: Page[] = SEED_PAGES,
): WikiStore {
  return {
    worlds: indexWorlds(worlds),
    pages: indexPages(pages),
  };
}

/** Singleton store for dev and demo. */
let defaultStore: WikiStore | null = null;

export function getWikiStore(): WikiStore {
  if (!defaultStore) {
    defaultStore = createWikiStore();
  }
  return defaultStore;
}

/** Reset store — useful in tests. */
export function resetWikiStore(store?: WikiStore): void {
  defaultStore = store ?? createWikiStore();
}

export function pageUrlPath(
  worldSlug: string,
  category: PageCategory,
  slug: string,
): string {
  return `/worlds/${worldSlug}/${category}/${slug}`;
}

export function buildPagePath(page: Page, worldSlug: string): string {
  return pageUrlPath(worldSlug, page.category, page.slug);
}
