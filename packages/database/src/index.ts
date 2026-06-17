/**
 * UWE Core database layer.
 *
 * Phase 1: in-memory wiki store (Studio/Portal UI + wiki-engine)
 * Phase 2: Prisma repository (structured source of truth) — see `@uwe/database/server`
 */

export const DATABASE_PACKAGE_VERSION = "0.2.0";

// --- Phase 1: in-memory wiki store ---

export type {
  Page,
  PageCategory,
  PagePath,
  PageRelation,
  PageVisibility,
  World,
} from "./types";

export {
  buildPageLookupIndex,
  getPageById,
  getPageByPath,
  getWorldById,
  getWorldBySlug,
  isPlayerVisible,
  listPagesInWorld,
  listPlayerVisiblePages,
  listWorlds,
  normalizeLookupKey,
  pageHref,
  pagePathFromPage,
  resolvePageByLinkTarget,
} from "./queries";

export {
  buildPagePath,
  createWikiStore,
  getWikiStore,
  pageUrlPath,
  resetWikiStore,
  type WikiStore,
} from "./store";

export { SEED_PAGES, SEED_WORLDS } from "./seed";

export { parseWikiLinks, type ParsedWikiLink } from "./wikilink-utils";
