/**
 * Server-only database exports (Prisma, auth, repository).
 * Import from `@uwe/database/server` in Next.js route handlers and server components.
 */

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
  getDbWorldBySlug,
  getDbPageById,
  getPageWithLinks,
  addContentBlock,
  getNextContentBlockSortOrder,
  createIdeaPage,
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

export { AuthService, createAuthService } from "./auth";
export type { CreateUserInput, CreateWorldMembershipInput } from "./auth";

export {
  DEV_SEED_PASSWORD,
  seedAuthDemoContent,
  seedAuthUsers,
} from "./auth-seed";
export type { SeedAuthUsersResult } from "./auth-seed";

export { seedTerraWorld } from "./terra-seed";
