/**
 * UWE Wiki Engine — wikilinks, backlinks, related pages, broken link detection.
 */

export const WIKI_ENGINE_VERSION = "0.2.0";

export type { ParsedWikiLink, WikiLink } from "./parseWikiLinks";
export { parseWikiLinks, parseWikiLinksLegacy } from "./parseWikiLinks";

export type {
  Backlink,
  ResolvedLinkStatus,
  ResolvedWikiLink,
  ResolveWikiLinksOptions,
} from "./backlinks";
export { getBacklinks, resolveWikiLinks } from "./backlinks";

export type { RelatedPage, FindRelatedPagesOptions } from "./related";
export { findRelatedPages } from "./related";

export type { BrokenLink, BrokenLinkReport } from "./brokenLinks";
export {
  findBrokenLinks,
  findBrokenLinksReport,
  findPlayerVisibleBrokenLinks,
  wouldLeakSecretPage,
} from "./brokenLinks";

export type { PlayerSafePageView, PlayerFilterOptions } from "./render";
export {
  buildPlayerSafePageView,
  filterPageTitlesForPlayer,
  renderWikiContent,
  sanitizeLinkForPlayer,
} from "./render";

// Legacy export for backward compatibility
export { parseWikiLinksLegacy as parseWikiLinksCompat } from "./parseWikiLinks";
