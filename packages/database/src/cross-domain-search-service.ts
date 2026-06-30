import type { PrismaClient } from "./client";
import {
  searchAdminEntities,
  type AdminSearchOptions,
  type AdminSearchResultItem,
} from "./admin-search-service";
import {
  searchGlobalForDm,
  type SearchOptions,
  type SearchResultItem,
} from "./search-service";

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
}

export async function searchStudioCrossDomain(
  db: PrismaClient,
  options: StudioCrossDomainSearchOptions,
): Promise<StudioCrossDomainResult> {
  const scope = options.scope ?? "all";
  const query = options.query.trim();

  if (!query) {
    return { wiki: [], admin: [] };
  }

  const [wiki, admin] = await Promise.all([
    scope !== "admin"
      ? searchGlobalForDm(db, { query, ...options.wiki })
      : Promise.resolve([]),
    scope !== "worlds" && query.length >= 2
      ? searchAdminEntities(db, { query, ...options.admin })
      : Promise.resolve([]),
  ]);

  return { wiki, admin };
}
