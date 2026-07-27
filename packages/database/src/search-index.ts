import type { SearchIndexPageInput } from "./content-access";
import { parseStringArray } from "./json-utils";
import type { SearchIndexEntry } from "./search-service";

/**
 * Builds the search index over a set of pages.
 *
 * There used to be two indexes — a public one that dropped everything a player
 * was not allowed to see, and a studio one that kept everything. With per-item
 * visibility gone they would be byte-identical, so there is one index left.
 * Who may search a world is decided before this point, by world assignment.
 */
export function buildSearchIndex(pages: SearchIndexPageInput[]): SearchIndexEntry[] {
  return pages.map((page) => ({
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
    viewableBlockContent: page.contentBlocks.map((block) => block.content),
  }));
}
