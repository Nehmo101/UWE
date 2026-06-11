/**
 * UWE Core database layer — in-memory wiki store for Phase 1 wiki engine.
 * Prisma + SQLite/PostgreSQL planned for Phase 2.
 */

export const DATABASE_PACKAGE_VERSION = "0.2.0";

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

import { getWikiStore } from "./store";

export interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  message: string;
}

export function databaseHealthCheck(): HealthCheckResult {
  const store = getWikiStore();
  const worldCount = store.worlds.size;
  const pageCount = store.pages.size;

  return {
    status: "ok",
    message: `Wiki store active (${worldCount} worlds, ${pageCount} pages)`,
  };
}
