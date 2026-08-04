import type { AccessContext as AuthAccessContext } from "@uwe/auth";
import {
  canReadDmSections,
  canViewWorldContent,
  filterBlocksForViewer,
  filterPagesForViewer,
  redactDmSectionsForViewer,
} from "@uwe/auth";
import type { PrismaClient } from "./client";
import type {
  ContentBlock,
  CanonicalStatus,
  PageType,
  QuestLifecycleStatus,
} from "./generated/prisma/client";
import { parseStringArray } from "./json-utils";
import { loadEntityTagsByEntityIds } from "./entity-tag-search-service";
import { buildPageUrl } from "./page-types";
import { isOpenQuest } from "./quest-lifecycle-service";
import type { SearchIndexContentBlock } from "./content-access";
import { loadPagesForSearch, pageTypesForEntityFilter } from "./search-page-cache";
import { buildSearchIndex as buildIndex } from "./search-index";

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
  canonicalStatus: CanonicalStatus;
  questStatus: QuestLifecycleStatus | null;
  worldSlug: string;
  worldName: string;
  campaignName: string | null;
  viewableBlockContent: string[];
}

export type IndexedPage = {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  summary: string | null;
  tags: unknown;
  aliases: unknown;
  canonicalStatus: CanonicalStatus;
  questStatus?: QuestLifecycleStatus | null;
  campaignId: string | null;
  /** Muss mitgeladen sein — `filterPagesForViewer` ist fail-closed. */
  portalReleased: boolean;
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


export async function searchForWikiContext(
  db: PrismaClient,
  options: SearchOptions,
): Promise<SearchResultItem[]> {
  const pages = await loadPagesForSearch(db, options);
  return searchIndex(buildIndex(pages), options);
}

export async function searchForAuthContext(
  db: PrismaClient,
  context: AuthAccessContext,
  options: SearchOptions,
): Promise<SearchResultItem[]> {
  if (!canViewWorldContent(context)) {
    return [];
  }

  // Nach dem Memo-Cache, damit der kontextfreie Index unberührt bleibt: erst
  // fällt jede nicht freigegebene Seite als Ganzes weg (fail-closed, siehe
  // `filterPagesForViewer`), dann werden die DM-Bereiche geschnitten. Sonst
  // verriete ein Treffer Titel und Wortlaut einer gesperrten Seite.
  const pages = filterPagesForViewer(context, await loadPagesForSearch(db, options));
  return searchIndex(buildIndex(redactDmSectionsInPages(context, pages)), options);
}

/**
 * Schneidet die DM-Bereiche aus dem Suchindex, bevor er gebaut wird.
 *
 * Die Suche ist der Umweg, über den ein DM-Bereich sonst doch sichtbar würde:
 * Der Treffer verrät den Wortlaut im Ausschnitt, und selbst ohne Ausschnitt
 * verrät er, dass ein bestimmtes Wort auf einer bestimmten Seite steht.
 *
 * `loadPagesForSearch` gibt ein gemeinsam genutztes, memoisiertes Array zurück,
 * das niemand verändern darf — deshalb entstehen hier neue Objekte, und nur für
 * die Seiten, aus denen wirklich etwas herausfällt.
 */
function redactDmSectionsInPages(
  context: AuthAccessContext,
  pages: IndexedPage[],
): IndexedPage[] {
  if (canReadDmSections(context)) {
    return pages;
  }
  return pages.map((page) => {
    const summary = redactDmSectionsForViewer(context, page.summary);
    const contentBlocks = filterBlocksForViewer(context, page.contentBlocks);
    // Beide Helfer geben bei markenlosem Inhalt dasselbe Objekt zurück, nicht
    // nur ein gleiches — Identitätsvergleich reicht also aus.
    const changed = summary !== page.summary || contentBlocks !== page.contentBlocks;
    return changed ? { ...page, summary, contentBlocks } : page;
  });
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

  return searchIndex(buildIndex(enrichedPages), options);
}
