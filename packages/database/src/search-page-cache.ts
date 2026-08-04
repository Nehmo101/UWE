/**
 * Laden + Memoisieren der Seiten für den Suchindex — aus `search-service.ts`
 * herausgelöst, damit die Suchlogik und die Cache-Disziplin getrennt lesbar
 * bleiben. Verhalten unverändert; die große Begründung des Caches steht unten.
 */
import type { PrismaClient } from "./client";
import type { PageType } from "./generated/prisma/client";
import type { SearchIndexContentBlock } from "./content-access";
// Nur Typen — zur Laufzeit fließt der Import ausschließlich von hier nach
// search-service, nie zurück (kein Modul-Zyklus).
import type { IndexedPage, SearchEntityFilter, SearchOptions } from "./search-service";

export function pageTypesForEntityFilter(filter: SearchEntityFilter): PageType[] | null {
  switch (filter) {
    case "pages":
    case "content_blocks":
    case "labels":
      return null;
    case "npcs":
      return ["npc", "player_character", "monster"];
    case "quests":
      return ["quest"];
    case "locations":
      return ["location", "region"];
    case "factions":
      return ["faction"];
    case "sessions":
      return ["session"];
    case "dungeons":
      return ["dungeon", "dungeon_level", "trap", "puzzle", "loot", "secret"];
    case "rooms":
      return ["room"];
    case "encounters":
      return ["encounter"];
    case "assets":
      return ["map"];
    case "sounds":
      return ["sound"];
    case "handouts":
      return ["handout", "item"];
    default:
      return null;
  }
}

/**
 * SQLite/libsql cap the number of bind parameters per statement (~999).
 * Loading content blocks for every page of a large world in one
 * `WHERE pageId IN (...)` exceeds that ceiling at scale and throws P2029, so we
 * page the id list in safe chunks. 500 keeps each statement well under the cap.
 */
const SEARCH_BLOCK_PAGE_CHUNK = 500;

/**
 * The scope filters that determine which pages `loadPagesForSearch` materializes.
 * The loaded set depends only on these — never on the (per-keystroke) query — so
 * it is the correct memoization boundary.
 */
export type SearchScopeFilters = Pick<
  SearchOptions,
  "worldSlug" | "campaignId" | "entityFilter" | "canonicalStatusFilter"
>;

async function loadPagesForSearchUncached(
  db: PrismaClient,
  options: SearchScopeFilters,
): Promise<IndexedPage[]> {
  const types = options.entityFilter
    ? pageTypesForEntityFilter(options.entityFilter)
    : null;

  const canonicalFilter = options.canonicalStatusFilter;

  // Select only the columns the index and its authz filters read, instead of
  // hydrating whole rows via `include`. Behaviour is unchanged; the content
  // blocks are loaded separately (chunked) below and stitched back on.
  const pages = await db.page.findMany({
    where: {
      ...(options.worldSlug ? { world: { slug: options.worldSlug } } : {}),
      ...(options.campaignId ? { campaignId: options.campaignId } : {}),
      ...(types ? { type: { in: types } } : {}),
      ...(canonicalFilter
        ? {
            canonicalStatus: Array.isArray(canonicalFilter)
              ? { in: canonicalFilter }
              : canonicalFilter,
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      summary: true,
      tags: true,
      aliases: true,
      canonicalStatus: true,
      questStatus: true,
      campaignId: true,
      // Muss mit: `filterPagesForViewer` ist fail-closed und wirft ohne dieses
      // Feld jede Seite heraus (siehe `searchForAuthContext`).
      portalReleased: true,
      world: { select: { slug: true, name: true } },
      campaign: { select: { name: true } },
    },
    orderBy: [{ title: "asc" }],
  });

  const blocksByPageId = new Map<string, SearchIndexContentBlock[]>();
  for (let offset = 0; offset < pages.length; offset += SEARCH_BLOCK_PAGE_CHUNK) {
    const pageIds = pages
      .slice(offset, offset + SEARCH_BLOCK_PAGE_CHUNK)
      .map((page) => page.id);
    const blocks = await db.contentBlock.findMany({
      where: { pageId: { in: pageIds } },
      select: {
        id: true,
        pageId: true,
        content: true,
        type: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: "asc" },
    });
    for (const block of blocks) {
      let list = blocksByPageId.get(block.pageId);
      if (!list) {
        list = [];
        blocksByPageId.set(block.pageId, list);
      }
      list.push(block);
    }
  }

  return pages.map((page) => ({
    ...page,
    contentBlocks: blocksByPageId.get(page.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Search index memoization (WS4)
// ---------------------------------------------------------------------------
//
// Studio/portal search fires `loadPagesForSearch` on EVERY keystroke. At mega
// scale (10k pages / 40k blocks) that materializes the whole world DB — a
// `findMany` over all page columns plus a chunked re-fetch of every content
// block — for a query string that changes by one character. The loaded page
// set does NOT depend on the query, only on the scope filters, so we memoize it
// per scope and reuse it until the underlying content changes.
//
// Why this can never serve STALE results (correctness is the whole job):
//   * Keyed per `PrismaClient` instance (a WeakMap): a different connection or
//     database can never read another's cached rows, and an entry is GC'd with
//     its client. The app runs one process-wide singleton client, so keystrokes
//     hit the cache; tests that create a fresh client start with an empty cache.
//   * Every call recomputes a cheap "freshness key" = COUNT + MAX(updated_at)
//     over BOTH `page` and `content_block` for the world (or global) scope, and
//     reuses the cached pages only when the key is byte-identical.
//   * Content-block edits bump `ContentBlock.updated_at` but NOT the owning
//     `Page.updated_at` (see `repository.updateContentBlock`), so a page-only
//     key would serve stale block text. Folding the block count + max in closes
//     that gap: inserts change COUNT (and MAX), edits change MAX, deletes change
//     COUNT — any block mutation moves the key.
//   * The key is computed over the world SUPERSET (or the global superset when
//     no `worldSlug`), so a narrower cache entry (campaign / entityFilter /
//     canonicalStatus) can never miss an invalidating change that its world saw.
//   * Entity-tag enrichment (`searchGlobalForDm`) and all authz/scope filtering
//     run OUTSIDE the cache on the returned pages, so tag changes and per-viewer
//     access are always recomputed — never memoized.
//
// The returned array (and its page objects) is shared and MUST be treated as
// read-only; every caller already derives new objects rather than mutating.
//
// Residual caveat: renaming a World or Campaign changes the embedded
// world/campaign display name without touching page/block `updated_at`; the
// cached name self-heals on the next page/block edit. Also `updated_at` is not
// indexed, so at extreme global scale the COUNT/MAX is a two-column table scan —
// still far cheaper than loading + transforming every page and block, but a
// dedicated `@@index([updatedAt])` would make the key query O(log n).

interface CachedScopePages {
  freshnessKey: string;
  pages: IndexedPage[];
}

const SEARCH_PAGES_CACHE_LIMIT = 16;
const searchPagesCacheByClient = new WeakMap<
  PrismaClient,
  Map<string, CachedScopePages>
>();

function scopeCacheId(options: SearchScopeFilters): string {
  const canonical = options.canonicalStatusFilter;
  const canonicalKey = canonical
    ? (Array.isArray(canonical) ? [...canonical].sort() : [canonical]).join(",")
    : "*";
  return [
    `w:${options.worldSlug ?? "*"}`,
    `c:${options.campaignId ?? "*"}`,
    `t:${options.entityFilter ?? "*"}`,
    `cs:${canonicalKey}`,
  ].join("|");
}

async function computeScopeFreshnessKey(
  db: PrismaClient,
  worldSlug: string | undefined,
): Promise<string> {
  const pageWhere = worldSlug ? { world: { slug: worldSlug } } : {};
  const blockWhere = worldSlug ? { page: { world: { slug: worldSlug } } } : {};
  const [pageAgg, blockAgg] = await Promise.all([
    db.page.aggregate({
      where: pageWhere,
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    db.contentBlock.aggregate({
      where: blockWhere,
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
  ]);
  const pageMax = pageAgg._max.updatedAt?.getTime() ?? 0;
  const blockMax = blockAgg._max.updatedAt?.getTime() ?? 0;
  return `p:${pageAgg._count._all}:${pageMax}|b:${blockAgg._count._all}:${blockMax}`;
}

export async function loadPagesForSearch(
  db: PrismaClient,
  options: SearchScopeFilters,
): Promise<IndexedPage[]> {
  const cacheId = scopeCacheId(options);
  const freshnessKey = await computeScopeFreshnessKey(db, options.worldSlug);

  const existingCache = searchPagesCacheByClient.get(db);
  const cached = existingCache?.get(cacheId);
  if (existingCache && cached && cached.freshnessKey === freshnessKey) {
    // Refresh LRU recency: re-insert so this scope is the most-recently used.
    existingCache.delete(cacheId);
    existingCache.set(cacheId, cached);
    return cached.pages;
  }

  const pages = await loadPagesForSearchUncached(db, options);

  const clientCache = existingCache ?? new Map<string, CachedScopePages>();
  if (!existingCache) {
    searchPagesCacheByClient.set(db, clientCache);
  }
  clientCache.delete(cacheId);
  clientCache.set(cacheId, { freshnessKey, pages });
  // Bound the cache: Map preserves insertion order, so the first key is the
  // least-recently used — evict it until we are back under the limit.
  while (clientCache.size > SEARCH_PAGES_CACHE_LIMIT) {
    const oldest = clientCache.keys().next().value;
    if (oldest === undefined) break;
    clientCache.delete(oldest);
  }

  return pages;
}
