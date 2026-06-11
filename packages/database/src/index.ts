/**
 * UWE Core database layer.
 *
 * Phase 1: in-memory wiki store (Studio/Portal UI + wiki-engine)
 * Phase 2: Prisma repository (structured source of truth)
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

// --- Phase 2: Prisma repository ---

export { createPrismaClient, prisma, resolveDatabaseUrl } from "./client";
export type { PrismaClient } from "./client";

export { databaseHealthCheck } from "./health";
export type { HealthCheckResult } from "./health";

export {
  createUweRepository,
  createWorld,
  createPage,
  getPageBySlug,
  listPagesByWorld,
  getPublicPageForPortal,
  getDmPage,
  UweRepository,
} from "./repository";

export type {
  Campaign as DbCampaign,
  CanonicalStatus,
  ContentBlock as DbContentBlock,
  ContentBlockType,
  Page as DbPage,
  PageLink as DbPageLink,
  PageType,
  PublishStatus,
  Visibility,
  World as DbWorld,
  CreateWorldInput,
  CreatePageInput,
  CreateContentBlockInput,
  PageWithBlocks,
  PublicPage,
} from "./repository";

export {
  CanonicalStatusEnum,
  ContentBlockTypeEnum,
  PageTypeEnum,
  PublishStatusEnum,
  VisibilityEnum,
} from "./repository";

export { seedTerraWorld } from "./terra-seed";
