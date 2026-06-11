/**
 * Server-only database exports (Prisma, auth, repository, portal services).
 * Import from `@uwe/database/server` in Next.js route handlers and server components.
 */

export { createPrismaClient, prisma, resolveDatabaseUrl } from "./client";
export type { PrismaClient } from "./client";
export type { Prisma } from "./generated/prisma/client";

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
  parseWikiLinks,
  renderPageContentHtml,
  type PageViewData,
  type WikiPageNode,
} from "./page-service";

export {
  buildPageGraph,
  buildWorldGraph,
  graphCategoryForPageType,
  graphNodeCategoryLabel,
  GRAPH_NODE_CATEGORIES,
  GRAPH_NODE_CATEGORY_LABELS,
  type GraphEdge,
  type GraphEdgeKind,
  type GraphFilters,
  type GraphNode,
  type GraphNodeCategory,
  type GraphViewMode,
  type WorldGraphData,
} from "./graph-service";

export { AuthService, createAuthService } from "./auth";
export type { CreateUserInput, CreateWorldMembershipInput } from "./auth";

export {
  DEV_SEED_PASSWORD,
  seedAuthDemoContent,
  seedAuthUsers,
} from "./auth-seed";
export type { SeedAuthUsersResult } from "./auth-seed";

export { seedTerraWorld } from "./terra-seed";

export {
  SEARCH_ENTITY_FILTERS,
  SEARCH_ENTITY_FILTER_LABELS,
  buildSearchIndex,
  searchForAuthContext,
  searchForWikiContext,
  searchGlobalForDm,
  searchIndex,
  type SearchEntityFilter,
  type SearchMatchField,
  type SearchOptions,
  type SearchResultItem,
  type SearchUrlMode,
} from "./search-service";

export {
  createGameSessionService,
  GameSessionService,
  GAME_SESSION_STATUS_LABELS,
  toDmGameSessionView,
  toPortalGameSessionView,
  GameSessionStatusEnum,
} from "./game-session";

export type {
  CreateGameSessionInput,
  UpdateGameSessionInput,
  DmGameSessionView,
  PortalGameSessionView,
  GameSessionWithLinks,
  GameSessionStatus,
} from "./game-session";

export {
  createDungeonCockpitService,
  DungeonCockpitService,
  DUNGEON_PREP_STATUS_LABELS,
  DUNGEON_PAGE_TYPES,
  ROOM_CHILD_TYPES,
  categorizeRoomBlocks,
  filterRoomChildren,
  toPortalRoomCockpitView,
  suggestSlugFromTitle,
  DungeonPrepStatusEnum,
} from "./dungeon-cockpit";

export type {
  CreateDungeonEntityInput,
  UpdateDungeonEntityInput,
  DmDungeonOverview,
  DmLevelOverview,
  DmRoomCockpitView,
  PortalRoomCockpitView,
  DungeonEntitySummary,
  RoomChildType,
  DungeonPrepStatus,
} from "./dungeon-cockpit";

export {
  createLabelService,
  LabelService,
  LABEL_SOURCE_TYPE_LABELS,
  LabelSourceTypeEnum,
  normalizeLabel,
  applyLayoutToContent,
  assertPlayerSafeExport,
  buildLabelContentFromPage,
  buildLabelContentFromBlock,
  buildLabelContentFromAsset,
} from "./label-service";

export type {
  Label as DbLabel,
  LabelTemplate as DbLabelTemplate,
  LabelSourceType,
  LabelLayoutMode,
  LabelLayoutSettings,
  LabelContentData,
  CreateLabelInput,
  UpdateLabelInput,
  CreateLabelFromSourceInput,
  LabelWithRelations,
} from "./label-service";

export {
  renderLabelHtml,
  renderLabelPdf,
  renderLabelExport,
} from "./label-export";

export type { LabelExportOptions } from "./label-export";

export {
  createSoundboardService,
  SoundboardService,
  extractYouTubeVideoId,
  isSoundboardButtonVisibleInPortal,
  resolveThumbnail,
  toDmSoundboardButtonView,
  toPortalSoundboardButtonView,
  SoundSourceTypeEnum,
} from "./soundboard";

export type {
  CreateSoundboardButtonInput,
  UpdateSoundboardButtonInput,
  DmSoundboardButtonView,
  PortalSoundboardButtonView,
  SoundboardButtonWithLinks,
  SoundSourceType,
} from "./soundboard";
