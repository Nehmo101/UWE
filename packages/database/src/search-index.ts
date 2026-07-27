import type { ContentBlock } from "./generated/prisma/client";
import {
  filterBlocksForContext,
  isPageAccessible,
  type AccessContext,
  type PortalAccessOptions,
} from "./permissions";
import {
  isBlockPlayerExposable,
  isPagePlayerExposable,
  type SearchIndexPageInput,
  type SearchIndexScope,
} from "./content-access";
import { parseStringArray } from "./json-utils";
import type { SearchIndexEntry } from "./search-service";

function pageToSearchIndexEntry(
  page: SearchIndexPageInput,
  viewableBlockContent: string[],
): SearchIndexEntry {
  return {
    pageId: page.id,
    title: page.title,
    slug: page.slug,
    type: page.type,
    summary: page.summary,
    tags: parseStringArray(page.tags),
    aliases: parseStringArray(page.aliases),
    visibility: page.visibility,
    canonicalStatus: page.canonicalStatus,
    questStatus: page.questStatus ?? null,
    worldSlug: page.world.slug,
    worldName: page.world.name,
    campaignName: page.campaign?.name ?? null,
    viewableBlockContent,
  };
}

/**
 * Public search index: only published, player-visible content without hidden secrets.
 * Used for portal, preview, and player API search.
 */
export function buildPublicSearchIndex(pages: SearchIndexPageInput[]): SearchIndexEntry[] {
  return pages
    .filter((page) => isPagePlayerExposable(page))
    .map((page) => {
      const viewableBlocks = page.contentBlocks.filter((block) => isBlockPlayerExposable(block));
      return pageToSearchIndexEntry(
        page,
        viewableBlocks.map((block) => block.content),
      );
    });
}

/**
 * Studio / DM search index: all content regardless of visibility or secrets.
 */
export function buildStudioSearchIndex(pages: SearchIndexPageInput[]): SearchIndexEntry[] {
  return pages.map((page) =>
    pageToSearchIndexEntry(
      page,
      page.contentBlocks.map((block) => block.content),
    ),
  );
}

export function buildSearchIndexForScope(
  pages: SearchIndexPageInput[],
  scope: SearchIndexScope,
  context?: AccessContext,
  portalOptions?: PortalAccessOptions,
): SearchIndexEntry[] {
  if (scope === "studio") {
    return buildStudioSearchIndex(pages);
  }

  if (context && context !== "dm") {
    const accessiblePages = pages.filter((page) => isPageAccessible(page, context, portalOptions));
    return buildPublicSearchIndex(
      accessiblePages.map((page) => ({
        ...page,
        contentBlocks: filterBlocksForContext(page.contentBlocks, context, portalOptions),
      })),
    );
  }

  return buildPublicSearchIndex(pages);
}

export function getViewableBlockContentForScope(
  page: SearchIndexPageInput,
  scope: SearchIndexScope,
  getContextBlocks?: (page: SearchIndexPageInput) => ContentBlock[],
): string[] {
  if (scope === "studio") {
    return page.contentBlocks.map((block) => block.content);
  }

  const blocks = getContextBlocks ? getContextBlocks(page) : page.contentBlocks;
  return blocks.filter((block) => isBlockPlayerExposable(block)).map((block) => block.content);
}
