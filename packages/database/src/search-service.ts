import type { AccessContext as AuthAccessContext } from "@uwe/auth";
import { canViewContentBlock, canViewPage } from "@uwe/auth";
import type { PrismaClient } from "./client";
import type {
  ContentBlock,
  CanonicalStatus,
  PageType,
  PublishStatus,
  QuestLifecycleStatus,
  Visibility,
} from "./generated/prisma/client";
import { parseStringArray } from "./json-utils";
import { loadEntityTagsByEntityIds } from "./entity-tag-search-service";
import { buildPageUrl } from "./page-types";
import { isOpenQuest } from "./quest-lifecycle-service";
import {
  type AccessContext as WikiAccessContext,
  type PortalAccessOptions,
} from "./permissions";
import type { SearchIndexContentBlock } from "./content-access";
import { buildSearchIndexForScope } from "./search-index";

export const SEARCH_ENTITY_FILTERS = [
  "pages",
  "content_blocks",
  "npcs",
  "quests",
  "locations",
  "factions",
  "sessions",
  "dungeons",
  "rooms",
  "encounters",
  "assets",
  "sounds",
  "labels",
  "handouts",
] as const;

export type SearchEntityFilter = (typeof SEARCH_ENTITY_FILTERS)[number];

export const SEARCH_ENTITY_FILTER_LABELS: Record<SearchEntityFilter, string> = {
  pages: "Seiten",
  content_blocks: "Inhaltsblöcke",
  npcs: "NPCs",
  quests: "Quests",
  locations: "Orte",
  factions: "Fraktionen",
  sessions: "Sessions",
  dungeons: "Dungeons",
  rooms: "Räume",
  encounters: "Encounter",
  assets: "Assets",
  sounds: "Sounds",
  labels: "Labels",
  handouts: "Handouts",
};

export type SearchMatchField =
  | "title"
  | "slug"
  | "summary"
  | "tags"
  | "aliases"
  | "content";

export type SearchUrlMode = "studio" | "portal" | "auth-portal";

export interface SearchOptions {
  query: string;
  worldSlug?: string;
  campaignId?: string | null;
  entityFilter?: SearchEntityFilter;
  visibilityFilter?: Visibility[];
  canonicalStatusFilter?: CanonicalStatus | CanonicalStatus[];
  /**
   * Restricts results to quest pages with the given lifecycle status.
   * "open" also matches quests without an explicit status (unset counts as open).
   */
  questStatusFilter?: QuestLifecycleStatus;
  limit?: number;
  urlMode?: SearchUrlMode;
}

export interface SearchResultItem {
  pageId: string;
  title: string;
  slug: string;
  type: PageType;
  worldSlug: string;
  worldName: string;
  campaignName: string | null;
  visibility: Visibility;
  publishStatus: PublishStatus;
  canonicalStatus: CanonicalStatus;
  questStatus: QuestLifecycleStatus | null;
  href: string;
  matchedFields: SearchMatchField[];
  snippet: string | null;
  score: number;
}

export interface SearchIndexEntry {
  pageId: string;
  title: string;
  slug: string;
  type: PageType;
  summary: string | null;
  tags: string[];
  aliases: string[];
  visibility: Visibility;
  publishStatus: PublishStatus;
  canonicalStatus: CanonicalStatus;
  questStatus: QuestLifecycleStatus | null;
  worldSlug: string;
  worldName: string;
  campaignName: string | null;
  viewableBlockContent: string[];
}

type IndexedPage = {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  summary: string | null;
  tags: unknown;
  aliases: unknown;
  visibility: Visibility;
  publishStatus: PublishStatus;
  canonicalStatus: CanonicalStatus;
  questStatus?: QuestLifecycleStatus | null;
  campaignId: string | null;
  contentBlocks: SearchIndexContentBlock[];
  world: { slug: string; name: string };
  campaign: { name: string } | null;
};

const FIELD_SCORE: Record<SearchMatchField, number> = {
  title: 100,
  aliases: 90,
  tags: 80,
  summary: 70,
  slug: 60,
  content: 40,
};

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("de");
}

function matchesQuery(text: string, query: string): boolean {
  if (!query) return false;
  return text.toLocaleLowerCase("de").includes(query);
}

function extractSnippet(text: string, query: string, maxLen = 140): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const lower = normalized.toLocaleLowerCase("de");
  const idx = lower.indexOf(query);
  if (idx === -1) {
    return normalized.length > maxLen ? `${normalized.slice(0, maxLen)}…` : normalized;
  }

  const start = Math.max(0, idx - 45);
  const end = Math.min(normalized.length, idx + query.length + 75);
  let snippet = normalized.slice(start, end);
  if (start > 0) snippet = `…${snippet}`;
  if (end < normalized.length) snippet = `${snippet}…`;
  return snippet;
}

function pageTypesForEntityFilter(filter: SearchEntityFilter): PageType[] | null {
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

function buildResultHref(
  worldSlug: string,
  type: PageType,
  slug: string,
  urlMode: SearchUrlMode,
): string {
  if (urlMode === "auth-portal") {
    return `/auth/worlds/${worldSlug}/${slug}`;
  }
  return buildPageUrl(worldSlug, type, slug);
}

export function buildSearchIndex(
  pages: IndexedPage[],
  getViewableBlocks: (page: IndexedPage) => ContentBlock[],
): SearchIndexEntry[] {
  return pages.map((page) => {
    const viewableBlocks = getViewableBlocks(page);
    return {
      pageId: page.id,
      title: page.title,
      slug: page.slug,
      type: page.type,
      summary: page.summary,
      tags: parseStringArray(page.tags),
      aliases: parseStringArray(page.aliases),
      visibility: page.visibility,
      publishStatus: page.publishStatus,
      canonicalStatus: page.canonicalStatus,
      questStatus: page.questStatus ?? null,
      worldSlug: page.world.slug,
      worldName: page.world.name,
      campaignName: page.campaign?.name ?? null,
      viewableBlockContent: viewableBlocks.map((block) => block.content),
    };
  });
}

function scoreMatches(fields: SearchMatchField[]): number {
  if (fields.length === 0) return 0;
  return Math.max(...fields.map((field) => FIELD_SCORE[field]));
}

function pickSnippet(
  entry: SearchIndexEntry,
  matchedFields: SearchMatchField[],
  query: string,
): string | null {
  const priority: SearchMatchField[] = [
    "summary",
    "content",
    "title",
    "aliases",
    "tags",
    "slug",
  ];

  for (const field of priority) {
    if (!matchedFields.includes(field)) continue;

    switch (field) {
      case "title":
        return entry.title;
      case "slug":
        return entry.slug;
      case "summary":
        return entry.summary ? extractSnippet(entry.summary, query) : null;
      case "tags":
        return entry.tags.filter((tag) => matchesQuery(tag, query)).join(", ");
      case "aliases":
        return entry.aliases.filter((alias) => matchesQuery(alias, query)).join(", ");
      case "content": {
        const block = entry.viewableBlockContent.find((content) => matchesQuery(content, query));
        return block ? extractSnippet(block, query) : null;
      }
      default:
        break;
    }
  }

  return entry.summary ?? entry.title;
}

function findMatches(
  entry: SearchIndexEntry,
  query: string,
  entityFilter?: SearchEntityFilter,
): SearchMatchField[] {
  const matched: SearchMatchField[] = [];

  const titleMatch = matchesQuery(entry.title, query);
  const slugMatch = matchesQuery(entry.slug, query);
  const summaryMatch = entry.summary ? matchesQuery(entry.summary, query) : false;
  const tagMatch = entry.tags.some((tag) => matchesQuery(tag, query));
  const aliasMatch = entry.aliases.some((alias) => matchesQuery(alias, query));
  const contentMatch = entry.viewableBlockContent.some((content) => matchesQuery(content, query));

  if (titleMatch) matched.push("title");
  if (slugMatch) matched.push("slug");
  if (summaryMatch) matched.push("summary");
  if (tagMatch) matched.push("tags");
  if (aliasMatch) matched.push("aliases");
  if (contentMatch) matched.push("content");

  if (!entityFilter || entityFilter === "pages") {
    return matched;
  }

  if (entityFilter === "content_blocks") {
    return contentMatch ? ["content"] : [];
  }

  if (entityFilter === "labels") {
    return tagMatch ? ["tags"] : [];
  }

  const allowedTypes = pageTypesForEntityFilter(entityFilter);
  if (allowedTypes && !allowedTypes.includes(entry.type)) {
    return [];
  }

  return matched;
}

export function searchIndex(
  index: SearchIndexEntry[],
  options: SearchOptions,
): SearchResultItem[] {
  const query = normalizeQuery(options.query);
  if (!query) return [];

  const urlMode = options.urlMode ?? "studio";
  const limit = options.limit ?? 50;

  const results: SearchResultItem[] = [];

  for (const entry of index) {
    if (options.worldSlug && entry.worldSlug !== options.worldSlug) {
      continue;
    }

    if (options.visibilityFilter?.length && !options.visibilityFilter.includes(entry.visibility)) {
      continue;
    }

    if (options.canonicalStatusFilter) {
      const allowed = Array.isArray(options.canonicalStatusFilter)
        ? options.canonicalStatusFilter
        : [options.canonicalStatusFilter];
      if (!allowed.includes(entry.canonicalStatus)) {
        continue;
      }
    }

    if (options.questStatusFilter) {
      if (entry.type !== "quest") {
        continue;
      }
      const statusMatches =
        options.questStatusFilter === "open"
          ? isOpenQuest(entry.questStatus)
          : entry.questStatus === options.questStatusFilter;
      if (!statusMatches) {
        continue;
      }
    }

    const matchedFields = findMatches(entry, query, options.entityFilter);
    if (matchedFields.length === 0) {
      continue;
    }

    results.push({
      pageId: entry.pageId,
      title: entry.title,
      slug: entry.slug,
      type: entry.type,
      worldSlug: entry.worldSlug,
      worldName: entry.worldName,
      campaignName: entry.campaignName,
      visibility: entry.visibility,
      publishStatus: entry.publishStatus,
      canonicalStatus: entry.canonicalStatus,
      questStatus: entry.questStatus,
      href: buildResultHref(entry.worldSlug, entry.type, entry.slug, urlMode),
      matchedFields,
      snippet: pickSnippet(entry, matchedFields, query),
      score: scoreMatches(matchedFields),
    });
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "de")).slice(0, limit);
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
type SearchScopeFilters = Pick<
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
      visibility: true,
      publishStatus: true,
      canonicalStatus: true,
      questStatus: true,
      campaignId: true,
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
        visibility: true,
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
//     visibility are always recomputed — never memoized.
//
// The returned array (and its page objects) is shared and MUST be treated as
// read-only; every caller already derives new objects rather than mutating.
//
// Residual caveat: renaming a World or Campaign changes the embedded
// world/campaign display name without touching page/block `updated_at`; the
// cached name self-heals on the next page/block edit. No content or visibility
// can leak because both are recomputed downstream. Also `updated_at` is not
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

async function loadPagesForSearch(
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

export async function searchForWikiContext(
  db: PrismaClient,
  context: WikiAccessContext,
  options: SearchOptions,
  portalOptions?: PortalAccessOptions,
): Promise<SearchResultItem[]> {
  const pages = await loadPagesForSearch(db, options);
  const scope = context === "dm" ? "studio" : "public";
  const index = buildSearchIndexForScope(pages, scope, context, portalOptions);

  return searchIndex(index, options);
}

export async function searchForAuthContext(
  db: PrismaClient,
  context: AuthAccessContext,
  options: SearchOptions,
): Promise<SearchResultItem[]> {
  const pages = await loadPagesForSearch(db, options);
  const accessiblePages = pages.filter((page) => canViewPage(context, page));

  const index = buildSearchIndexForScope(
    accessiblePages.map((page) => ({
      ...page,
      contentBlocks: page.contentBlocks.filter((block) => canViewContentBlock(context, block, page)),
    })),
    "public",
  );

  return searchIndex(index, options);
}

export async function searchGlobalForDm(
  db: PrismaClient,
  options: SearchOptions,
): Promise<SearchResultItem[]> {
  const pages = await loadPagesForSearch(db, options);
  const pageIds = pages.map((page) => page.id);
  const entityTagsByPage = await loadEntityTagsByEntityIds(db, "page", pageIds);

  const enrichedPages = pages.map((page) => {
    const mergedTags = [
      ...new Set([
        ...parseStringArray(page.tags),
        ...(entityTagsByPage.get(page.id) ?? []),
      ]),
    ];
    return {
      ...page,
      tags: mergedTags,
    };
  });

  const index = buildSearchIndexForScope(enrichedPages, "studio");
  return searchIndex(index, options);
}
