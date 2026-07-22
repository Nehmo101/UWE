import type { PrismaClient } from "./client";
import type { BrainPrismaClient } from "./brain-client";
import {
  searchAdminEntities,
  type AdminSearchOptions,
  type AdminSearchResultItem,
} from "./admin-search-service";
import {
  searchEntitiesByTagQuery,
  type EntityTagSearchResult,
} from "./entity-tag-search-service";
import {
  searchGlobalForDm,
  type SearchOptions,
  type SearchResultItem,
} from "./search-service";
import {
  searchStudioMedia,
  type StudioMediaSearchResult,
} from "./studio-media-search-service";

export type StudioSearchScope = "admin" | "worlds" | "all";

export interface StudioCrossDomainSearchOptions {
  query: string;
  scope?: StudioSearchScope;
  wiki?: Omit<SearchOptions, "query">;
  admin?: Omit<AdminSearchOptions, "query">;
}

export interface StudioCrossDomainResult {
  wiki: SearchResultItem[];
  admin: AdminSearchResultItem[];
  media: StudioMediaSearchResult[];
  tags: EntityTagSearchResult[];
}

export async function searchStudioCrossDomain(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  options: StudioCrossDomainSearchOptions,
): Promise<StudioCrossDomainResult> {
  const scope = options.scope ?? "all";
  const query = options.query.trim();
  const worldSlug = options.wiki?.worldSlug;

  if (!query) {
    return { wiki: [], admin: [], media: [], tags: [] };
  }

  const includeWiki = scope !== "admin";
  const includeAdmin = scope !== "worlds" && query.length >= 2;
  const includeMedia = includeWiki && query.length >= 2;
  const includeTags = query.length >= 2;

  const [wiki, admin, media, tags] = await Promise.all([
    includeWiki
      ? searchGlobalForDm(db, { query, ...options.wiki })
      : Promise.resolve([]),
    includeAdmin
      ? searchAdminEntities(db, { query, ...options.admin })
      : Promise.resolve([]),
    includeMedia
      ? searchStudioMedia(db, { query, worldSlug, limit: 24 })
      : Promise.resolve([]),
    includeTags
      ? searchEntitiesByTagQuery(db, brainDb, {
          query,
          limit: scope === "admin" ? 30 : 20,
        })
      : Promise.resolve([]),
  ]);

  const filteredTags =
    scope === "admin"
      ? tags.filter((hit) =>
          [
            "capture",
            "project",
            "workshop",
            "contract",
            "hardware",
            "dev_idea",
            "personal_brain_document",
            "personal_brain_fact",
          ].includes(hit.entityType),
        )
      : scope === "worlds"
        ? tags.filter((hit) =>
            ["page", "asset", "soundboard_button"].includes(hit.entityType),
          )
        : tags;

  return { wiki, admin, media, tags: filteredTags };
}
