import type { AccessContext as AuthAccessContext } from "@uwe/auth";
import { canViewContentBlock, canViewPage } from "@uwe/auth";
import type { PrismaClient } from "./client";
import type {
  ContentBlock,
  PageType,
  PublishStatus,
  Visibility,
} from "./generated/prisma/client";
import { parseStringArray } from "./json-utils";
import { buildPageUrl } from "./page-types";
import {
  type AccessContext as WikiAccessContext,
  type PortalAccessOptions,
} from "./permissions";
import { buildSearchIndexForScope } from "./search-index";

export const SEARCH_ENTITY_FILTERS = [
  "pages",
  "content_blocks",
  "npcs",
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
  campaignId: string | null;
  contentBlocks: ContentBlock[];
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
      href: buildResultHref(entry.worldSlug, entry.type, entry.slug, urlMode),
      matchedFields,
      snippet: pickSnippet(entry, matchedFields, query),
      score: scoreMatches(matchedFields),
    });
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "de")).slice(0, limit);
}

async function loadPagesForSearch(
  db: PrismaClient,
  options: Pick<SearchOptions, "worldSlug" | "campaignId" | "entityFilter">,
): Promise<IndexedPage[]> {
  const types = options.entityFilter
    ? pageTypesForEntityFilter(options.entityFilter)
    : null;

  return db.page.findMany({
    where: {
      ...(options.worldSlug ? { world: { slug: options.worldSlug } } : {}),
      ...(options.campaignId ? { campaignId: options.campaignId } : {}),
      ...(types ? { type: { in: types } } : {}),
    },
    include: {
      contentBlocks: { orderBy: { sortOrder: "asc" } },
      world: { select: { slug: true, name: true } },
      campaign: { select: { name: true } },
    },
    orderBy: [{ title: "asc" }],
  });
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
  return searchForWikiContext(db, "dm", options);
}
