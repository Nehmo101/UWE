import { buildPagePath } from "./store";
import type { Page, PageCategory, PagePath, PageVisibility, World } from "./types";
import type { WikiStore } from "./store";
import { normalizeLookupKey } from "./slug-utils";

export function listWorlds(store: WikiStore): World[] {
  return [...store.worlds.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getWorldBySlug(store: WikiStore, slug: string): World | undefined {
  return [...store.worlds.values()].find((w) => w.slug === slug);
}

export function getWorldById(store: WikiStore, id: string): World | undefined {
  return store.worlds.get(id);
}

export function listPagesInWorld(store: WikiStore, worldId: string): Page[] {
  return [...store.pages.values()]
    .filter((p) => p.worldId === worldId)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getPageByPath(
  store: WikiStore,
  worldSlug: string,
  category: PageCategory,
  slug: string,
): Page | undefined {
  const world = getWorldBySlug(store, worldSlug);
  if (!world) return undefined;

  return [...store.pages.values()].find(
    (p) =>
      p.worldId === world.id &&
      p.category === category &&
      p.slug === slug,
  );
}

export function getPageById(store: WikiStore, id: string): Page | undefined {
  return store.pages.get(id);
}

export function pagePathFromPage(store: WikiStore, page: Page): PagePath | undefined {
  const world = getWorldById(store, page.worldId);
  if (!world) return undefined;

  return {
    worldSlug: world.slug,
    category: page.category,
    slug: page.slug,
  };
}

export function pageHref(store: WikiStore, page: Page): string | undefined {
  const world = getWorldById(store, page.worldId);
  if (!world) return undefined;
  return buildPagePath(page, world.slug);
}

export function isPlayerVisible(visibility: PageVisibility): boolean {
  return visibility === "player_visible" || visibility === "public";
}

export function listPlayerVisiblePages(store: WikiStore, worldId: string): Page[] {
  return listPagesInWorld(store, worldId).filter((p) => isPlayerVisible(p.visibility));
}

/** Build lookup index: normalized key → page (title + aliases, scoped to world). */
export function buildPageLookupIndex(
  store: WikiStore,
  worldId: string,
  options?: { playerVisibleOnly?: boolean },
): Map<string, Page> {
  const index = new Map<string, Page>();
  const pages = listPagesInWorld(store, worldId).filter(
    (p) => !options?.playerVisibleOnly || isPlayerVisible(p.visibility),
  );

  for (const page of pages) {
    index.set(normalizeLookupKey(page.title), page);
    index.set(normalizeLookupKey(page.slug), page);
    for (const alias of page.aliases) {
      index.set(normalizeLookupKey(alias), page);
    }
  }

  return index;
}

export { normalizeLookupKey };

export function resolvePageByLinkTarget(
  store: WikiStore,
  worldId: string,
  target: string,
  options?: { playerVisibleOnly?: boolean },
): Page | undefined {
  const index = buildPageLookupIndex(store, worldId, options);
  return index.get(normalizeLookupKey(target));
}
