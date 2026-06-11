/**
 * Server-only database exports (Prisma, auth, repository, portal services).
 * Import from `@uwe/database/server` in Next.js route handlers and server components.
 */

export { createPrismaClient, prisma, resolveDatabaseUrl } from "./client";
export type { PrismaClient } from "./client";

export { databaseHealthCheck, type HealthCheckResult } from "./health-server";

export { getAppRepository } from "./app-repository";

export {
  createUweRepository,
  createWorld,
  createPage,
  getPageBySlug,
  listPagesByWorld,
  getPublicPageForPortal,
  getDmPage,
  getDbWorldBySlug,
  getDbPageById,
  getPageWithLinks,
  addContentBlock,
  getNextContentBlockSortOrder,
  createIdeaPage,
  UweRepository,
  PORTAL_BLOCK_VISIBILITIES,
  PORTAL_PAGE_VISIBILITIES,
  isPortalPageVisibility,
  isPublishedForPortal,
} from "./repository";

export type {
  Campaign as DbCampaign,
  Asset as DbAsset,
  AssetType,
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
  CreateCampaignInput,
  CreatePageInput,
  UpdatePageInput,
  UpdateContentBlockInput,
  CreateContentBlockInput,
  CreateAssetInput,
  UpdateAssetInput,
  PageWithBlocks,
  PageSummary,
  PublicPage,
} from "./repository";

export {
  CanonicalStatusEnum,
  ContentBlockTypeEnum,
  AssetTypeEnum,
  PageTypeEnum,
  PublishStatusEnum,
  VisibilityEnum,
} from "./repository";

export {
  filterBlocksForContext,
  filterAssetsForContext,
  isPageAccessible,
  isPortalAssetVisibility,
  isPortalBlockVisibility,
  isAssetAccessible,
  shouldHidePageTitle,
  PORTAL_ASSET_VISIBILITIES,
  type AccessContext,
} from "./permissions";

export {
  NAV_CATEGORIES,
  NAV_CATEGORY_LABELS,
  buildPageUrl,
  navCategoryForPageType,
  pageTypesForNavCategory,
  type NavCategory,
} from "./page-types";

export { parseStringArray, toJsonArray } from "./json-utils";

export {
  buildPageView,
  buildWorldWikiIndex,
  combineBlockContent,
  pageToWikiNode,
  type PageViewData,
  type WikiPageNode,
} from "./page-service";

export { AuthService, createAuthService } from "./auth";
export type { CreateUserInput, CreateWorldMembershipInput } from "./auth";

export {
  DEV_SEED_PASSWORD,
  seedAuthDemoContent,
  seedAuthUsers,
} from "./auth-seed";
export type { SeedAuthUsersResult } from "./auth-seed";

export { seedTerraWorld } from "./terra-seed";
