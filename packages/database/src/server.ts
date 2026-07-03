/**
 * Server-only database exports (Prisma, auth, repository, portal services).
 * Import from `@uwe/database/server` in Next.js route handlers and server components.
 */

export { createPrismaClient, prisma, resolveDatabaseUrl } from "./client";
export type { PrismaClient } from "./client";
export type { Prisma } from "./generated/prisma/client";

export { databaseHealthCheck, type HealthCheckResult } from "./health-server";
export {
  buildDetailedHealthPayload,
  evaluatePublicHealth,
  type BuildDetailedHealthOptions,
  type DetailedHealthPayload,
  type HealthAppName,
} from "./health-endpoints";
export { UWE_PRODUCT_NAME, UWE_VERSION } from "./version";

export { getAppRepository } from "./app-repository";

export {
  createUweRepository,
  createUweRepositoryFromClient,
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
  listPageLinksForPage,
  updatePageLink,
  deletePageLink,
  PORTAL_BLOCK_VISIBILITIES,
  PORTAL_PAGE_VISIBILITIES,
  isPortalPageVisibility,
  isPublishedForPortal,
} from "./repository";

export {
  WorldCreationService,
  createWorldCreationService,
} from "./world-creation-service";

export type { CreateWorldRequest, CreatedWorldResult } from "./world-creation-service";

export {
  createWorldCalendarService,
  advanceInGameDate,
  DEFAULT_IN_GAME_DATE,
  DEFAULT_WORLD_CALENDAR_MONTHS,
  formatInGameDate,
  parseDayNames,
  parseInGameDate,
  parseWorldCalendarMonths,
  WorldCalendarService,
} from "./world-calendar-service";

export type {
  InGameDate,
  UpsertWorldCalendarInput,
  WorldCalendarMonth,
} from "./world-calendar-service";

export {
  compareInGameDates,
  createWorldEventService,
  toPortalWorldEventView,
  WORLD_EVENT_ENTITY_ROLE_LABELS,
  WorldEventService,
} from "./world-event-service";

export type {
  CreateWorldEventInput,
  PortalWorldEventView,
  WorldEventWithLinks,
} from "./world-event-service";

export {
  buildPortalTimelineYearLabel,
  countPortalTimelineEventsThroughDate,
  enrichPortalTimelineEvents,
  groupPortalTimelineEventsByYear,
  isInGameDateBeforeOrEqual,
} from "./portal-timeline";

export type {
  PortalTimelineEventView,
  PortalTimelineYearGroup,
} from "./portal-timeline";

export {
  createFactionStateService,
  FactionStateService,
} from "./faction-state-service";

export type { UpsertFactionStateInput } from "./faction-state-service";

export {
  buildFactionSimulationPrompt,
  summarizeFactionStateForUi,
} from "./faction-simulation-prompt";

export type {
  FactionSimulationPromptInput,
  FactionSimulationStateSnapshot,
} from "./faction-simulation-prompt";

export {
  abilityModifier,
  ABILITY_KEYS,
  buildCharacterSheetSnapshot,
  computeCharacterDerivedStats,
  createCharacterService,
  DEFAULT_ABILITY_SCORES,
  extractCharacterProficiencyFormInput,
  inferSpellcastingAbility,
  parseAbilityScores,
  parseCharacterCombat,
  parseCharacterSkillProfile,
  parseSpellcastingConfig,
  passiveScore,
  proficiencyBonus,
  resolveSpellcastingAbility,
  savingThrowModifier,
  SKILL_DEFINITIONS,
  skillModifier,
  skillProficiencyLevel,
  spellAttackBonus,
  spellSaveDc,
  toPortalCharacterView,
  CharacterService,
} from "./character-service";

export {
  buildHomebrewSpellKey,
  computeSpellSlots,
  createCharacterSpellService,
  effectiveCasterLevel,
  extractOpen5eSpellDescription,
  extractOpen5eSpellLevel,
  extractOpen5eSpellSchool,
  formatSpellDisplayName,
  parseCharacterClasses,
  parseHomebrewSpellInput,
  toCharacterSpellView,
  CharacterSpellService,
} from "./character-spell-service";

export type {
  AbilityScores,
  CharacterCombat,
  CharacterDerivedStats,
  CharacterSavingThrowView,
  CharacterSheetSnapshot,
  CharacterSkillProfile,
  CharacterSkillView,
  CreateCharacterInput,
  PortalCharacterView,
  SkillDefinition,
  SkillKey,
  SkillProficiencyLevel,
  SpellcastingAbilitySetting,
  SpellcastingConfig,
  UpdateCharacterInput,
  UpsertCharacterSpellInput,
} from "./character-service";

export type {
  CharacterClassEntry,
  CharacterSpellView,
  ParsedHomebrewSpell,
  SpellSlotSummary,
} from "./character-spell-service";

export {
  buildLevelUpApplyPayload,
  buildLevelUpSuggestions,
  getClassHitDie,
  PICKABLE_CLASSES,
} from "./character-level-up-service";

export type {
  ApplyLevelUpOptions,
  LevelUpApplyPayload,
  LevelUpCharacterInput,
  LevelUpFieldKey,
  LevelUpFieldSuggestion,
  LevelUpSuggestions,
  PickableClassName,
} from "./character-level-up-service";

export {
  buildCharacterSheetMarkdown,
  buildCharacterSheetPrintHtml,
  buildCharacterSheetPrintStyles,
} from "./character-sheet-export";

export type {
  CharacterInventoryItemView,
  CharacterSheetExportInput,
} from "./character-sheet-export";

export {
  createPartyTreasuryService,
  DEFAULT_CURRENCIES,
  getInventoryItemDmNotes,
  isInventoryItemDmOnly,
  PartyTreasuryService,
  toPlayerSafeInventoryItemView,
} from "./party-treasury-service";

export type {
  CreateInventoryItemInput,
  CurrencyLedger,
  MovePartyItemForViewerInput,
  PlayerSafeInventoryItemView,
  PortalTreasuryView,
  UpsertPartyTreasuryInput,
} from "./party-treasury-service";

export {
  createQuestLifecycleService,
  isOpenQuest,
  QUEST_LIFECYCLE_LABELS,
  QuestLifecycleService,
} from "./quest-lifecycle-service";

export {
  createStructuredStatblockService,
  StructuredStatblockService,
} from "./structured-statblock-service";

export type { UpsertStructuredStatblockInput } from "./structured-statblock-service";

export {
  applyGeneratorPresetToSchema,
  buildStructuredGeneratorPrompt,
  formatStructuredGeneratorMarkdown,
  getStructuredGeneratorSchema,
  isStructuredGeneratorTarget,
  parseGeneratorPresetTemplate,
  parseStructuredGeneratorOutput,
  STRUCTURED_GENERATOR_FIELD_MAX_LENGTH,
  STRUCTURED_GENERATOR_SCHEMAS,
  validateStructuredGeneratorInput,
} from "./structured-generator-schemas";

export type {
  GeneratorPresetTemplateFields,
  StructuredGeneratorField,
  StructuredGeneratorInputIssue,
  StructuredGeneratorInputResult,
  StructuredGeneratorOutput,
  StructuredGeneratorSchema,
  StructuredGeneratorTarget,
} from "./structured-generator-schemas";

export type { QuestLifecycleStatus } from "./generated/prisma/client";

export {
  getWorldTemplate,
  listWorldTemplateOptions,
  resolveWorldTemplateId,
  type WorldTemplateId,
  type WorldTemplateOption,
} from "./world-templates";
export { NON_SANDBOX_WORLD_WHERE, assertWorldExportAllowed } from "./world-sandbox";

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
  PageLinkWithPages,
  PageLinksForPage,
  PageLinkPageInfo,
  PublicPage,
} from "./repository";

export {
  PAGE_LINK_RELATION_PRESETS,
  PAGE_LINK_RELATION_LABELS,
  isPageLinkRelationPreset,
  pageLinkRelationLabel,
  type PageLinkRelationPreset,
} from "./page-link-presets";

export {
  CANONICAL_LIFECYCLE_FILTER_STATUSES,
  isCanonicalLifecycleFilterStatus,
} from "./canon-lifecycle";

export type { CanonicalLifecycleFilterStatus } from "./canon-lifecycle";

export {
  CanonicalStatusEnum,
  ContentBlockTypeEnum,
  AssetTypeEnum,
  PageTypeEnum,
  PublishStatusEnum,
  RevealStateEnum,
  SecretLevelEnum,
  VisibilityEnum,
} from "./repository";

export {
  isPlayerExposableContent,
  isBlockPlayerExposable,
  isPagePlayerExposable,
  isSecretVisibleToPlayer,
  isDmOnlyVisibility,
  isPlayerPortalVisibility,
  mapPublishStatusToContentStatus,
  sanitizeForPlayer,
  detectPrivateReferences,
  formatPrivateReferenceWarning,
  PLAYER_PORTAL_VISIBILITIES,
  type ContentAccessFields,
  type ContentStatus,
  type ContentVisibility,
  type SanitizedPage,
  type SecretLevel,
  type RevealState,
} from "./content-access";

export {
  buildPublicSearchIndex,
  buildStudioSearchIndex,
  buildSearchIndexForScope,
} from "./search-index";

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
  type ShareAccessGrant,
  type PortalAccessOptions,
  type PageAccessOptions,
} from "./permissions";

export {
  NAV_CATEGORIES,
  NAV_CATEGORY_LABELS,
  buildPageUrl,
  navCategoryForPageType,
  pageTypesForNavCategory,
  type NavCategory,
} from "./page-types";

export { parseStringArray, toJsonArray, toPrismaJsonValue, withParsedArrays } from "./json-utils";

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
export { TwoFactorService, createTwoFactorService } from "./two-factor-service";
export type { CreateUserInput, CreateWorldMembershipInput } from "./auth";

export {
  UserService,
  createUserService,
  USER_SAFE_SELECT,
  isGlobalAdminRole,
} from "./user-service";
export {
  evaluatePortalAccessForUser,
  portalAccessBadgeFromUser,
} from "./portal-access-service";
export type {
  PortalAccessCheck,
  PortalAccessEvaluation,
  PortalAccessSummary,
  PortalAccessibleWorldSummary,
} from "./portal-access-service";
export type {
  CreateManagedUserInput,
  UpdateManagedUserInput,
  ResetPasswordInput,
  ChangePasswordInput,
  ChangePasswordResult,
  SetInitialPasswordInput,
  InviteUserResult,
} from "./user-service";

export {
  completePasswordReset,
  requestPasswordReset,
} from "./auth-password-reset";
export type { PasswordResetSurface } from "./auth-password-reset";

export {
  DEV_SEED_PASSWORD,
  seedAuthDemoContent,
  seedAuthUsers,
} from "./auth-seed";
export type { SeedAuthUsersResult } from "./auth-seed";

export { seedTerraWorld, seedTerraChronicle } from "./terra-seed";
export { seedStressWorld, PERF_SMOKE_SCALE, PERF_STRESS_SCALE } from "./stress-seed";
export type { StressSeedResult } from "./stress-seed";
export {
  PERF_BUDGETS_MS,
  PERF_MEGA_SCALE,
  assertWithinBudget,
  resolveStressScale,
} from "./perf-budgets";
export {
  backfillEntityTagsFromJson,
  canonicalizeTag,
  collectTagInventory,
  createTagService,
  ENTITY_TAG_ENTITY_TYPE_LABELS,
  findSimilarTagGroups,
  findUnusedTags,
  getTagCoverageStats,
  mergeTags,
  normalizeTagKey,
  suggestTagMerges,
} from "./tag-service";
export type {
  BackfillEntityTagsResult,
  SimilarTagGroup,
  TagCoverageStats,
  TagCoverageTypeStats,
  TagEntityType,
  TagInventoryEntry,
  TagMergeResult,
  TagMergeSuggestion,
  TagReference,
} from "./tag-service";

export {
  createEntityTagService,
  EntityTagService,
} from "./entity-tag-service";
export type {
  AttachEntityTagInput,
  EntityTag,
  EntityTagEntityType,
  Tag,
  TagWithUsageCount,
  UpsertTagInput,
} from "./entity-tag-service";
export { EntityTagEntityTypeEnum } from "./entity-tag-service";

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
  PAGE_TEMPLATES,
  getPageTemplate,
  pickUniqueSlug,
  slugifyPageTitle,
} from "./page-templates";

export type { PageTemplate, PageTemplateBlock } from "./page-templates";

export {
  createPageTemplateService,
  ensureSystemPageTemplates,
  parseTemplateBlocks,
  PageTemplateService,
  PAGE_TEMPLATE_SEED_KEY,
  PAGE_TEMPLATE_SEED_VERSION,
} from "./page-template-service";

export type {
  PageTemplateInput,
  PageTemplateView,
} from "./page-template-service";

export {
  ACTIVITY_ACTION_LABELS,
  ActivityLogService,
  createActivityLogService,
} from "./activity-log-service";

export type {
  ActivityLogEntryView,
  ListActivityOptions,
  LogActivityInput,
} from "./activity-log-service";

export {
  AUDIT_ACTION_LABELS,
  AuditLogService,
  auditRequestFromHeaders,
  createAuditLogService,
  hashClientIp,
  hashUserAgent,
  logAuditEvent,
  redactAuditMetadata,
} from "./audit-log-service";

export {
  LOGIN_AUDIT_REASON_LABELS,
  logLoginAttempt,
  resolveLoginFailureReason,
} from "./login-audit";

export type {
  LoginAuditReason,
  LoginAuditSurface,
  LogLoginAttemptInput,
  ResolveLoginFailureReasonInput,
} from "./login-audit";

export type {
  AuditLogEntryView,
  AuditRequestContext,
  ListAuditLogOptions,
  LogAuditEventInput,
} from "./audit-log-service";

export {
  ApiTokenService,
  createApiTokenService,
} from "./api-token-service";

export type {
  ApiTokenView,
  CreateApiTokenInput,
  CreateApiTokenResult,
  ResolvedApiToken,
} from "./api-token-service";

export {
  WebhookService,
  WEBHOOK_EVENTS,
  createWebhookService,
} from "./webhook-service";

export type {
  CreateWebhookInput,
  CreateWebhookResult,
  WebhookEndpointView,
  WebhookEvent,
} from "./webhook-service";

export {
  SecurityWarningService,
  createSecurityWarningService,
  syncSecurityWarningsFromDashboard,
} from "./security-warning-service";

export type { PersistedSecurityWarning } from "./security-warning-service";

export type {
  ActivityAction,
  ActivityTargetType,
  AuditAction,
  AuditTargetType,
} from "./generated/prisma/client";

export {
  createUndoService,
  UndoService,
} from "./undo-service";

export type { UndoOperation, UndoResult, ImportPageUpdateSnapshot } from "./undo-service";

export {
  AiReviewService,
  createAiReviewService,
  allowedApplyModes,
  buildGeneratedPatch,
  suggestApplyMode,
} from "./ai-review-service";

export type {
  AiProposalApplyMode,
  AiProposalView,
  ApplyAiProposalInput,
  ApplyAiProposalResult,
  ApplyBrainProposalInput,
  GeneratedPatch,
  JsonBrainProposal,
  RecordAiRunInput,
  RecordAiRunResult,
} from "./ai-review-service";

export {
  createInspectorFixService,
  InspectorFixService,
} from "./inspector-fix-service";

export type {
  ApplyInspectorFixInput,
  InspectorFixResult,
} from "./inspector-fix-service";

export {
  autoLinkWikitext,
  buildWikitextLinkTerms,
  convertWikitext,
  structureWikitext,
} from "./wikitext-convert";

export type {
  WikitextAddedLink,
  WikitextConversionOptions,
  WikitextConversionResult,
  WikitextLinkTerm,
} from "./wikitext-convert";

export {
  createWikitextConvertService,
  WikitextConvertService,
} from "./wikitext-convert-service";

export type {
  WikitextConvertApplyResult,
  WikitextConvertBlockPreview,
  WikitextConvertOptions,
  WikitextConvertPreview,
} from "./wikitext-convert-service";

export {
  isSeedApplied,
  listSeedHistory,
  runSeedOnce,
} from "./seed-tracker";

export type { SeedStatus } from "./seed-tracker";

export {
  getMigrationStatus,
  listMigrationDirectories,
} from "./migration-status";

export type { MigrationStatus } from "./migration-status";

export {
  NL_COMMAND_INTENTS,
  NlCommandService,
  buildConfirmationMessage,
  createNlCommandService,
  isMutationIntent,
  isNlCommandIntentName,
  issueConfirmationToken,
  parseCommandIntent,
  verifyConfirmationToken,
} from "./nl-command-service";

export type {
  NlCommandExecutionContext,
  NlCommandExecutionResult,
  NlCommandIntent,
  NlCommandIntentName,
  ParseCommandResult,
} from "./nl-command-service";

export { getAppRuntimeStatus, getProxyStatus, getStorageStatus, getSystemStatus } from "./system-status";

export type {
  AppRuntimeStatus,
  MailStatus,
  ProxyStatus,
  SeedStatusSummary,
  StorageStatus,
  SystemStatus,
  TrustStatus,
} from "./system-status";

export {
  assertAdminStatusHasNoSecrets,
  getAdminStatus,
  getAiRunSummaryStatus,
  getAuthHealthStatus,
  getBrainStoreHealthStatus,
  getEmbeddingHealthStatus,
  getJobsHealthStatus,
  getMailHealthStatus,
} from "./admin-status";

export type {
  AdminStatus,
  AiRunSummaryItem,
  AiRunSummaryStatus,
  AuthHealthStatus,
  BrainStoreHealthStatus,
  EmbeddingHealthStatus,
  JobsHealthStatus,
  MailHealthStatus,
} from "./admin-status";

export {
  assertSecretsStatusHasNoSecrets,
  getSecretsStatusSnapshot,
} from "./secrets-status-service";

export type {
  SecretItemStatus,
  SecretSource,
  SecretsStatusItem,
  SecretsStatusOptions,
  SecretsStatusSection,
  SecretsStatusSnapshot,
  SecretsStatusWarning,
  SecretsStatusWarningSeverity,
} from "./secrets-status-service";

export {
  assertOwnerSetupHasNoSecrets,
  formatSetupSourceBadge,
  getOwnerSetupSnapshot,
} from "./owner-setup-service";

export type {
  OwnerSetupSectionId,
  OwnerSetupSnapshot,
  OwnerSetupOptions,
  SetupSectionLevel,
  SetupSectionStatus,
  SetupSettingItem,
  SetupSettingSource,
} from "./owner-setup-service";

export { getAdminOnboardingChecklist } from "./admin-onboarding-checklist-service";

export type {
  AdminChecklistItem,
  AdminOnboardingChecklist,
  ChecklistItemStatus as AdminChecklistItemStatus,
} from "./admin-onboarding-checklist-service";

export {
  CAMPAIGN_JOB_PRESETS,
  resolveCampaignPresetHref,
} from "./campaign-job-presets";

export type {
  CampaignJobPreset,
  CampaignJobPresetKind,
} from "./campaign-job-presets";

export {
  assessRtxExposure,
  assessStudioSecurity,
  classifyEndpointUrl,
} from "./studio-security";

export type {
  EndpointExposureCheck,
  RtxExposureAssessment,
  StudioSecurityAssessment,
  StudioSecurityLevel,
  StudioSecuritySeverity,
} from "./studio-security";

export { buildNextActions } from "./next-actions";

export type { NextActionItem } from "./next-actions";

export {
  createWorldOverviewService,
  WorldOverviewService,
} from "./world-overview";

export {
  createWorldOpenItemsService,
  groupOpenItemsByCategory,
  WORLD_OPEN_ITEM_CATEGORY_LABELS,
  WorldOpenItemsService,
} from "./world-open-items-service";

export type {
  WorldOpenItem,
  WorldOpenItemCategory,
} from "./world-open-items-service";

export {
  createPortalDashboardService,
  PortalDashboardService,
  sessionUnlockLabel,
  navCategoryForPageType as portalDashboardNavCategory,
} from "./portal-dashboard-service";

export type {
  PortalDashboardData,
  PortalDashboardHandout,
  PortalDashboardNote,
  PortalDashboardPage,
  PortalDashboardSession,
} from "./portal-dashboard-service";

export type {
  WorldOverviewData,
  WorldOverviewOpenPlot,
  WorldOverviewPage,
  WorldOverviewSession,
} from "./world-overview";

export {
  createWorldInspectorService,
  WorldInspectorService,
  buildCanonFindings,
  buildSafetyFindings,
  sortFindings,
} from "./world-inspector";

export type {
  CanonFindingOptions,
  InspectorFinding,
  InspectorFindingCode,
  InspectorFixAction,
  InspectorFixSuggestion,
  InspectorSeverity,
  PortalVisibleAsset,
  PortalVisiblePage,
  ShareLinkOverview,
  WorldInspectorReport,
} from "./world-inspector";

export {
  buildGenericCanonConflictFindings,
  getExtendedCanonFindings,
  mergeCanonFindings,
  summarizeCanonSeverity,
} from "./canon-conflict-service";

export {
  extractPdfText,
  normalizePdfTextForImport,
  PdfExtractError,
} from "./pdf-text-extract";

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

// --- Labels (split candidate: packages/database/src/server/labels.ts) ---

export {
  createLabelService,
  LabelService,
  LABEL_SOURCE_TYPE_LABELS,
  LabelPrintStatusEnum,
  LabelSourceTypeEnum,
  normalizeLabel,
  applyLayoutToContent,
  assertPlayerSafeExport,
  buildLabelContentFromPage,
  buildLabelContentFromBlock,
  buildLabelContentFromAsset,
  ensureLabelElements,
  syncContentFromElements,
} from "./label-service";

export type {
  Label as DbLabel,
  LabelTemplate as DbLabelTemplate,
  LabelPrintStatus,
  LabelSourceType,
  LabelLayoutMode,
  LabelLayoutSettings,
  LabelContentData,
  LabelElement,
  LabelElementType,
  LabelFitMode,
  CreateLabelInput,
  UpdateLabelInput,
  CreateLabelFromSourceInput,
  CreateLabelTemplateInput,
  UpdateLabelTemplateInput,
  LabelWithRelations,
} from "./label-service";

export {
  ASSET_LINK_TARGET_LABELS,
  adoptAssetToTarget,
  linkAssetToTarget,
  listAssetLinksForAsset,
  listAssetsForTarget,
  syncImageStudioProjectLinksToAsset,
  unlinkAssetFromTarget,
} from "./asset-link-service";

export {
  AssetAlbumService,
  createAssetAlbumService,
} from "./asset-album-service";

export {
  proposeTagsForAsset,
  proposeTagsForAssets,
  storeAssetTagProposals,
  type AssetTagProposal,
} from "./asset-tag-proposal-service";

export type { AssetLinkRecord, AssetLinkTargetType, LinkAssetInput } from "./asset-link-service";

export {
  WORKSHOP_LABEL_TEMPLATE_SLUGS,
  buildFilamentLabelContent,
  buildUwePageQrUrl,
  buildWorkshopLabelContent,
  buildWorkshopLabelLayout,
  resolveFilamentLabelTemplateSlug,
  resolveWorkshopLabelTemplateSlug,
} from "./label-workshop-service";

export type { FilamentEntry, MaterialEntry } from "./label-workshop-service";

export { PRINT_CENTER_TEMPLATE_SLUGS } from "./print-center-presets";
export type { PrintCenterTemplateSlug } from "./print-center-presets";

export {
  createPrintListService,
  PrintListService,
  LABEL_PRINT_STATUS_LABELS,
  summarizePrintList,
} from "./label-print-list-service";

export type {
  CreatePrintListInput,
  UpdatePrintListInput,
  PrintListItemInput,
  PrintListWithItems,
} from "./label-print-list-service";

export {
  createLabelPrintQueueService,
  LabelPrintQueueService,
  LABEL_PRINT_QUEUE_STATUS_LABELS,
} from "./label-print-queue-service";

export type {
  EnqueuePrintListInput,
  LabelPrintDocument,
  LabelPrintQueueItem,
  LabelPrintQueueStatus,
} from "./label-print-queue-service";

export {
  assessTextFit,
  applyAutoFitToContent,
  restoreOriginalText,
  LABEL_FIT_STATUS_LABELS,
} from "./label-fit-service";

export type { LabelFitStatus, LabelFitResult, LabelFitOptions } from "./label-fit-service";

export {
  analyzeLabelSafety,
  stripDmOnlyForPlayer,
  removeDmOnlyElements,
  removeImagesFromContent,
} from "./label-safety";

export type { LabelSafetyWarning, LabelSafetyReport } from "./label-safety";

export {
  resolveLabelImageProvider,
  isLabelImageGenerationEnabled,
  DisabledLabelImageProvider,
} from "./label-image-provider";

export type {
  LabelImageProvider,
  LabelImageGenerateInput,
  LabelImageGenerateResult,
} from "./label-image-provider";

export {
  LABEL_CANVAS_WIDTH,
  LABEL_CANVAS_HEIGHT,
  LABEL_SAFE_MARGIN,
  createElementId,
  defaultElementsForMode,
  duplicateElement,
  snapValue,
  clampElementToCanvas,
} from "./label-elements";

export {
  renderLabelHtml,
  renderLabelPdf,
  renderLabelExport,
  renderLabelExportAsync,
  renderLabelPdfAsync,
  renderLabelSvg,
  renderMultiLabelHtml,
  renderMultiLabelPdfAsync,
} from "./label-export";

export type { LabelExportOptions, LabelExportResult, LabelExportRenderOptions } from "./label-export";

export {
  analyzeLabelExportWarnings,
  type LabelExportWarning,
} from "./label-export-warnings";

export {
  createShareLinkService,
  ShareLinkService,
  buildShareUrl,
  isShareLinkActive,
} from "./share-link-service";

export type {
  CreateShareLinkInput,
  UpdateShareLinkInput,
  ShareLinkValidationResult,
  ShareResolvedTarget,
  ShareAccessMeta,
  ShareLink as DbShareLink,
  ShareTargetType,
} from "./share-link-service";

export {
  createSettingsService,
  SettingsService,
  getSystemSettings,
  getSystemSettingsForClient,
  getSystemSettingsSnapshot,
  buildAppSettingsFromThemePreferences,
  DEFAULT_SYSTEM_SETTINGS,
  BACKGROUND_PATTERN_VALUES,
  sanitizeSettingsForClient,
  resolveEffectiveUploadsPath,
  resolveEffectiveBackupsPath,
  resolveEffectiveExportsPath,
  resolveEffectiveSmtpConfig,
  resolveSessionInactivityTimeoutMs,
  buildMailSmtpCredentialsUpdate,
  buildAiProviderKeyUpdate,
  resolveDecryptedProviderKeys,
  getPersistentPathConfiguration,
  isGuestPortalAccessAllowed,
  isMaintenanceModeActive,
  isPortalLocked,
  isStudioLocked,
  isPortalGloballyEnabled,
  isPublicSharingEnabled,
  resolveLocalOnlyMode,
} from "./settings-service";

export {
  evaluateMaintenanceGate,
  isMaintenanceGateBypassPath,
  isMaintenanceMiddlewareBypassPath,
  resolveMaintenanceGateContext,
} from "./maintenance-gate";

export type { MaintenanceGateContext, MaintenanceGateInput } from "./maintenance-gate";

export { evaluateMaintenanceForRequest } from "./maintenance-request";

export type { SystemSettingsSnapshot } from "./settings-service";

export {
  defaultThemePreferencesRecord,
  getThemePreferencesForScope,
  legacyThemePreferencesFromApp,
  mapClientBackgroundToServer,
  mapServerBackgroundToClient,
  normalizeAppThemePreferences,
  normalizeThemePreferencesRecord,
  resolveThemePreferencesForScope,
  withThemePreferencesForScope,
} from "./theme-preferences";

export type {
  AppThemePreferences,
  ThemeClientBackground,
  ThemeDensity,
  ThemeElementOverrides,
  ThemeFontFamily,
  ThemePreferencesRecord,
  ThemePreferencesScope,
} from "./theme-preferences";

export { validateSettingsUpdate } from "./settings-validation";

export {
  jobRequiresLocalRtx,
  isRtxOfflineError,
  RTX_REQUIRED_JOB_TYPES,
  DEFERRED_JOB_PROGRESS_LABEL,
} from "./rtx-deferred-jobs";

export type { RtxDeferCheckInput } from "./rtx-deferred-jobs";

export type {
  SettingsValidationError,
  SettingsValidationResult,
  ValidateSettingsUpdateResult,
} from "./settings-validation";

export {
  getBackupFreshnessStatus,
  getProductionSafetyWarnings,
  isPublicPortalExposureEnabled,
  isRunDbSeedUnsafe,
  isStudioApiTokenMissing,
  isWeakAuthSecret,
} from "./production-safety";

export type { ProductionSafetyWarning } from "./production-safety";

export {
  getOwnerCockpitSnapshot,
  OWNER_COCKPIT_ERROR_SOURCE_LABELS,
} from "./owner-cockpit-service";

export type {
  OwnerCockpitAiUsageSummary,
  OwnerCockpitErrorItem,
  OwnerCockpitSnapshot,
  OwnerCockpitWorldRow,
} from "./owner-cockpit-service";

export {
  listUnifiedActivity,
  countUnifiedActivity,
  UNIFIED_ACTIVITY_SOURCE_LABELS,
} from "./unified-activity-service";

export type {
  ListUnifiedActivityOptions,
  UnifiedActivityEntry,
  UnifiedActivitySeverity,
  UnifiedActivitySource,
} from "./unified-activity-service";

export {
  assertSecurityDashboardHasNoSecrets,
  buildSecurityWarnings,
  getSecurityDashboardStatus,
  getUserRoleCounts,
} from "./security-dashboard";

export type {
  EnvSecretStatus,
  SecurityDashboardStatus,
  SecurityWarning,
  SecurityWarningSeverity,
  UserRoleCounts,
} from "./security-dashboard";

export { scanPublicContentLeaks } from "./public-leak-scanner";
export type {
  PublicLeakFinding,
  PublicLeakScanResult,
  PublicLeakSeverity,
} from "./public-leak-scanner";

export type {
  UweSystemSettings,
  UweSystemSettingsUpdate,
  AppSettings,
  WorldSettings,
  CampaignSettings,
  PortalSettings,
  AiSettings,
  AiProviderKeyPlaceholder,
  StorageSettings,
  BackupSettings,
  PrivacySettings,
  MaintenanceSettings,
  MailSettings,
  ImageStudioSettings,
  ImageStudioPortalSettings,
  MailSmtpStatus,
  MailSmtpStoredCredentials,
  AiProviderStoredKey,
  PersistentPathConfiguration,
  PersistentPathEntry,
  PersistentPathSource,
  ThemeAppearance,
  BackgroundPattern,
} from "./settings-service";

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
  SoundboardServiceOptions,
  SoundSourceType,
} from "./soundboard";

export {
  createPlayerNoteService,
  PlayerNoteService,
  PLAYER_NOTE_STATUS_LABELS,
  PLAYER_NOTE_VISIBILITY_LABELS,
  toDmPlayerNoteView,
  toPortalPlayerNoteView,
  PlayerNoteStatusEnum,
  PlayerNoteVisibilityEnum,
} from "./player-note-service";

export type {
  CreatePlayerNoteInput,
  UpdatePlayerNoteInput,
  DmPlayerNoteView,
  PortalPlayerNoteView,
  PlayerNoteWithRelations,
  PlayerNoteStatus,
  PlayerNoteVisibility,
} from "./player-note-service";

export {
  createDashboardLayoutService,
  type DashboardLayoutService,
} from "./dashboard-layout-service";

export {
  DEFAULT_PORTAL_WORLD_LAYOUT,
  DEFAULT_STUDIO_TODAY_LAYOUT,
  DEFAULT_STUDIO_DASHBOARD_LAYOUT,
  DEFAULT_STUDIO_WORLD_DASHBOARD_LAYOUT,
  getDefaultDashboardLayout,
  normalizeDashboardWidgets,
  parseDashboardWidgets,
  portalWorldPageKey,
  studioWorldDashboardPageKey,
  STUDIO_TODAY_PAGE_KEY,
  STUDIO_DASHBOARD_PAGE_KEY,
  STUDIO_TODAY_WIDGET_TYPES,
  STUDIO_DASHBOARD_WIDGET_TYPES,
  STUDIO_WORLD_DASHBOARD_WIDGET_TYPES,
  PORTAL_WORLD_WIDGET_TYPES,
  validateDashboardWidgets,
  type DashboardLayoutResult,
  type DashboardWidgetColumn,
  type DashboardWidgetConfig,
  type PortalWorldWidgetType,
  type StudioTodayWidgetType,
  type StudioDashboardWidgetType,
  type StudioWorldDashboardWidgetType,
} from "./dashboard-layout-types";

export {
  createReviewService,
  ReviewService,
  CONTENT_REVIEW_STATUS_LABELS,
  CONTENT_REVIEW_SOURCE_LABELS,
} from "./review-service";

export type {
  ContentReviewView,
  ReviewCommentView,
  CreateContentReviewInput,
  ListReviewsOptions,
} from "./review-service";

export {
  resolveReview,
  syncAiProposalReview,
  syncPlayerNoteReview,
  createPortalUnlockReview,
  createCoDmChangeReview,
} from "./review-bridge";

export type { ResolveReviewResult } from "./review-bridge";

export {
  createSpotifyConnectionService,
  isSpotifyOAuthConfigured,
  resolveSpotifyOAuthConfig,
  SpotifyConnectionService,
} from "./spotify-connection-service";

export type { SpotifyConnectionStatus } from "./spotify-connection-service";

export {
  createJobService,
  JobService,
  JOB_TYPE_LABELS,
  JOB_STATUS_LABELS,
  RETRYABLE_JOB_TYPES,
} from "./job-service";

export type {
  EnqueueJobInput,
  JobLogView,
  JobSummary,
  JobView,
  JobStatus,
  JobType,
  ListJobsOptions,
} from "./job-service";

// --- Daily Admin OS / Life Admin (split candidate: life-admin-service.ts) ---

export {
  createLifeAdminService,
  LifeAdminService,
  CAPTURE_STATUS_LABELS,
  CAPTURE_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_CATEGORY_ORDER,
  PROJECT_ACTIVE_STATUSES,
  PROJECT_OPEN_STATUSES,
  WORKSHOP_STATUS_LABELS,
  WORKSHOP_STATUS_FLOW,
  getNextWorkshopStatus,
  CONTRACT_STATUS_LABELS,
  HARDWARE_STATUS_LABELS,
  PROJECT_CATEGORY_LABELS,
  WORKSHOP_TYPE_LABELS,
  WORKSHOP_PAINT_TARGET_LABELS,
  WORKSHOP_RENTAL_STATUS_LABELS,
  PERSONAL_BRAIN_CATEGORIES,
  PERSONAL_BRAIN_CATEGORY_LABELS,
  CaptureStatusEnum,
  CaptureTypeEnum,
  PersonalProjectStatusEnum,
  PersonalProjectCategoryEnum,
  WorkshopStatusEnum,
  WorkshopProjectTypeEnum,
  WorkshopPaintTargetEnum,
  WorkshopRentalStatusEnum,
  ContractStatusEnum,
  ContractExpenseTypeEnum,
  ContractExpenseSourceEnum,
  ContractBillingIntervalEnum,
  HardwareStatusEnum,
} from "./life-admin-service";

export {
  resolveCaptureUploadFilePath,
  saveCaptureUploadFile,
} from "./capture-upload";

export type {
  CreateAdminLinkInput,
  CreateCaptureInput,
  CreateContractExpenseInput,
  CreateGeneratorOutputInput,
  CreateGeneratorPresetInput,
  CreateHardwareDeviceInput,
  CreatePersonalBrainDocumentInput,
  CreatePersonalBrainFactInput,
  PromoteCaptureToLifeBrainInput,
  PersonalBrainDocumentDetail,
  PersonalBrainFactDetail,
  PersonalProjectDetail,
  PersonalProjectDashboardStats,
  PersonalProjectCategorySummary,
  CreatePersonalProjectInput,
  CreateWorkshopProjectInput,
  CreateWorkshopPaintRecipeInput,
  CreateWorkshopPrintProfileInput,
  CreateWorkshopTerrainRentalInput,
  ListCapturesOptions,
  TodayAdminSummary,
  WorkshopOpenTask,
  CaptureEntry,
  CaptureStatus,
  CaptureType,
  PersonalProject,
  PersonalProjectCategory,
  PersonalProjectStatus,
  WorkshopProject,
  WorkshopProjectType,
  WorkshopStatus,
  WorkshopPaintRecipe,
  WorkshopPrintProfile,
  WorkshopTerrainRental,
  WorkshopPaintTarget,
  WorkshopRentalStatus,
  ContractExpense,
  ContractExpenseType,
  ContractExpenseSource,
  ContractStatus,
  HardwareDevice,
  HardwareStatus,
  PersonalBrainDocument,
  PersonalBrainFact,
  AdminEntityLink,
  AdminLinkSourceType,
  AdminLinkTargetType,
  GeneratorPreset,
  GeneratorOutput,
} from "./life-admin-service";

export {
  buildCaptureAiProposal,
  CAPTURE_TRIAGE_ACTION_LABELS,
  CAPTURE_UPLOAD_NAMESPACE,
  createCaptureTriageService,
  CaptureTriageService,
  parseCaptureAiProposal,
  QUICK_CAPTURE_TYPE_OPTIONS,
} from "./capture-triage-service";

export type {
  CaptureAiProposal,
  CaptureProposalStatus,
  CaptureProposalTarget,
  CaptureTriageAction,
  CaptureTriageOptions,
  CaptureTriageResult,
} from "./capture-triage-service";

export {
  searchAdminEntities,
  ADMIN_SEARCH_ENTITY_TYPES,
  ADMIN_SEARCH_ENTITY_LABELS,
} from "./admin-search-service";

export type {
  AdminSearchEntityType,
  AdminSearchOptions,
  AdminSearchResultItem,
} from "./admin-search-service";

export {
  searchStudioCrossDomain,
} from "./cross-domain-search-service";

export type {
  StudioCrossDomainResult,
  StudioCrossDomainSearchOptions,
  StudioSearchScope,
} from "./cross-domain-search-service";

export {
  searchEntitiesByTagQuery,
  loadEntityTagsByEntityIds,
} from "./entity-tag-search-service";

export type {
  EntityTagSearchOptions,
  EntityTagSearchResult,
} from "./entity-tag-search-service";

export { searchStudioMedia } from "./studio-media-search-service";

export type {
  StudioMediaSearchOptions,
  StudioMediaSearchResult,
} from "./studio-media-search-service";

export {
  resolveAdminEntityLinks,
  listResolvedAdminLinksForEntity,
  ADMIN_LINK_RELATION_LABELS,
  ADMIN_LINK_SOURCE_LABELS,
  ADMIN_LINK_TARGET_LABELS,
} from "./admin-entity-link-resolver";

export type { ResolvedAdminEntityLink } from "./admin-entity-link-resolver";

export type { ContractBillingInterval } from "./generated/prisma/client";

export {
  buildAiUsageContractName,
  createAiUsageRollupService,
  formatUsdAmount,
  resolveAiUsagePeriodBounds,
  resolveUsdToEuroRate,
  usdToEuroCents,
  AiUsageRollupService,
} from "./ai-usage-rollup-service";
export type {
  AiUsageFeatureRollup,
  AiUsageRollupPeriod,
  AiUsageRollupSummary,
  AiUsageUserRollup,
} from "./ai-usage-rollup-service";

export {
  buildContractAlerts,
  formatEuroFromCents,
  normalizeToMonthlyCents,
  normalizeToYearlyCents,
  summarizeContractCosts,
  BILLING_INTERVAL_LABELS,
} from "./contract-expense-utils";

export type { ContractAlert, ContractCostSummary } from "./contract-expense-utils";

export {
  countOpenSetupSteps,
  detectHardwareUrlWarnings,
  extractHardwareRunbook,
  mergeHardwareRunbookMetadata,
} from "./hardware-utils";

export type { HardwareUrlWarning } from "./hardware-utils";

export {
  asMaterialList,
  asColorList,
  asFilamentList,
  asLinkList,
  asPhotoList,
  asChecklist,
  countMaterialsNeeded,
  firstPhotoUrl,
} from "./workshop-types";

export {
  parseMaterialsFromForm,
  formatMaterialsForForm,
  parseColorsFromForm,
  formatColorsForForm,
  parseFilamentsFromForm,
  formatFilamentsForForm,
  parseLinksFromForm,
  formatLinksForForm,
  parsePhotosFromForm,
  formatPhotosForForm,
  parseChecklistFromForm,
  formatChecklistForForm,
} from "./workshop-form-utils";

export {
  aggregateAllHardwareErrorHistory,
  aggregateHomelabTodayAlerts,
  appendHardwareErrorEntry,
  buildHomelabRunbooks,
  buildHomelabSecurityChecklist,
  buildHomelabServiceStatuses,
  buildHardwareDeviceCardView,
  parseHardwareErrorHistory,
  parseHardwareLastCheckedAt,
  parseHardwareServices,
  parseHardwareSpecsLines,
} from "./homelab-cockpit";

export {
  HostUpdateError,
  getHostGitInfo,
  getHostUpdateDashboard,
  isHostUpdateRequestFresh,
  readHostUpdateState,
  resolveHostUpdateAvailability,
  triggerHostUpdate,
} from "./host-update-service";

export type {
  HostGitInfo,
  HostUpdateAvailability,
  HostUpdateDashboard,
  HostUpdateState,
  HostUpdateStatus,
  TriggerHostUpdateInput,
  TriggerHostUpdateResult,
} from "./host-update-service";

export type {
  HardwareDeviceCardView,
  HardwareErrorEntry,
  HomelabHealthInput,
  HomelabRunbook,
  HomelabRunbookStep,
  HomelabSecurityCheckItem,
  HomelabServiceId,
  HomelabServiceStatus,
  HomelabSeverity,
  HomelabTodayAlerts,
} from "./homelab-cockpit";

export {
  serializePersonalBrainForPrompt,
  loadPersonalBrainPromptContext,
  filterPersonalBrainFactsByQuery,
  serializePersonalBrainRetrievalForPrompt,
  loadPersonalBrainAgentContext,
} from "./personal-brain-context";

export type {
  PersonalBrainDocSlice,
  PersonalBrainFactSlice,
  PersonalBrainRetrievedChunk,
  LoadPersonalBrainContextOptions,
  PersonalBrainAgentContextOptions,
} from "./personal-brain-context";

export { createPersonalBrainService } from "./personal-brain-service";

export type {
  CreatePersonalBrainChunkInput,
  PersonalBrainChunkRecord,
  PersonalBrainIndexStatus,
  PersonalBrainService,
} from "./personal-brain-service";

export {
  searchPersonalBrain,
  searchPersonalBrainDocuments,
  searchPersonalBrainFacts,
  collectPersonalBrainTags,
  parsePersonalBrainTags,
} from "./personal-brain-search";

export type {
  PersonalBrainSearchOptions,
  PersonalBrainSearchResult,
  PersonalBrainSearchableDoc,
  PersonalBrainSearchableFact,
  PersonalBrainSearchHit,
} from "./personal-brain-search";

export {
  resolveBrainCategoryForCaptureType,
  buildLifeBrainContentFromCapture,
} from "./personal-brain-capture";

export {
  assertPersonalBrainLocalOnly,
  isPersonalBrainContextAllowedForProvider,
  CLOUD_ALLOWED_CONTEXT_MODES,
} from "./personal-brain-privacy";

export type { CloudAllowedContextMode } from "./personal-brain-privacy";

export {
  DEFAULT_GENERATOR_PRESETS,
  detectMissingContent,
  listGeneratorActions,
  mapStructuredGeneratorAction,
  resolveGeneratorContextFromPage,
} from "./generator-service";

export type {
  GeneratorActionDefinition,
  GeneratorActionId,
  GeneratorContext,
  GeneratorContextType,
  MissingContentHint,
} from "./generator-service";

export {
  AI_RUN_STATUS_LABELS,
  AiRunService,
  createAiRunService,
  createAiRunServiceFromClient,
  AiRunStatusEnum,
} from "./ai-run-service";

export type {
  AiRunView,
  CreateAiRunInput,
  CompleteAiRunInput,
  FailAiRunInput,
  ListAiRunsOptions,
  AiRunStatus,
} from "./ai-run-service";

// --- DnD Brain store (split candidate: server/brain-store.ts) ---

export {
  createBrainStoreService,
  BrainStoreService,
  BRAIN_VISIBILITY_LABELS,
  BRAIN_STATUS_LABELS,
  BRAIN_SOURCE_LABELS,
  BRAIN_DOCUMENT_TYPE_LABELS,
  BRAIN_FACT_TYPE_LABELS,
  PORTAL_BRAIN_VISIBILITIES,
  filterBrainByVisibility,
  isPortalBrainVisibility,
  BrainDocumentTypeEnum,
  BrainFactTypeEnum,
  BrainLinkSourceTypeEnum,
  BrainLinkTargetTypeEnum,
  BrainSourceEnum,
  BrainStatusEnum,
  BrainVisibilityEnum,
} from "./brain-store-service";

export type {
  BrainAccessContext,
  BrainDocumentWithRelations,
  BrainFactWithRelations,
  CreateBrainDocumentInput,
  UpdateBrainDocumentInput,
  CreateBrainFactInput,
  UpdateBrainFactInput,
  CreateBrainChunkInput,
  CreateBrainLinkInput,
  ListBrainDocumentsOptions,
  ListBrainFactsOptions,
  SearchableBrainChunk,
  BrainDocumentType,
  BrainFactType,
  BrainLinkSourceType,
  BrainLinkTargetType,
  BrainSource,
  BrainStatus,
  BrainVisibility,
} from "./brain-store-service";

export {
  createMailLogService,
  MailLogService,
} from "./mail-log-service";

export type { MailLogEntry, CreateMailLogInput } from "./mail-log-service";

export {
  createMailTemplateService,
  MailTemplateService,
  MAIL_TEMPLATE_SEED_KEY,
  MAIL_TEMPLATE_SEED_VERSION,
} from "./mail-template-service";

export type { MailTemplateView, MailTemplateInput } from "./mail-template-service";

export {
  createMailRecipientService,
  MailRecipientService,
} from "./mail-recipient-service";

export type {
  MailRecipientView,
  MailRecipientGroupView,
  MailPlayerContact,
} from "./mail-recipient-service";

export {
  createMailService,
  MailService,
  getPublicMailConfigStatus,
  assertMailApiResponseHasNoSecrets,
} from "./mail-service";

export type { SendMailInput, SendMailResult } from "./mail-service";

export {
  createCalendarService,
  CalendarService,
  CALENDAR_EVENT_KIND_LABELS,
  CALENDAR_FEED_TYPE_LABELS,
  CalendarEventKindEnum,
  CalendarFeedTypeEnum,
  CalendarFeedDirectionEnum,
} from "./calendar-service";

export type {
  CreateCalendarFeedInput,
  CreateCalendarEventInput,
  ListCalendarEventsOptions,
  ListCalendarEventsForAggregationOptions,
  CalendarEvent,
  CalendarFeed,
  CalendarEventKind,
  CalendarFeedType,
  CalendarFeedDirection,
} from "./calendar-service";

export {
  createCalendarAggregationService,
  CalendarAggregationService,
  aggregateCalendarItems,
  splitCalendarItemsByDay,
  classifyUrgency,
  readMetadataDate,
  startOfDay,
  endOfDay,
  endOfWeek,
  BACKUP_CHECK_INTERVAL_DAYS,
  SESSION_PREP_LEAD_DAYS,
} from "./calendar-aggregation-service";

export type {
  AggregatedCalendarItem,
  CalendarItemSource,
  CalendarItemUrgency,
  CalendarAggregationInput,
  CalendarAggregationOptions,
} from "./calendar-aggregation-service";

export {
  createDevAgentJobService,
  DevAgentJobService,
  resolveAgentJobsConfig,
  DEV_AGENT_JOB_STATUS_LABELS,
  DEV_AGENT_JOB_PROVIDER_LABELS,
  DevAgentJobStatusEnum,
  DevAgentJobProviderEnum,
} from "./agent-job-service";

export type {
  CreateDevAgentJobInput,
  UpdateDevAgentJobInput,
  DevAgentJob,
  DevAgentJobStatus,
  DevAgentJobProvider,
  AgentJobsConfig,
} from "./agent-job-service";

export {
  createDevIdeaService,
  DevIdeaService,
  parseDevIdeaTranscript,
  DEV_IDEA_STATUS_LABELS,
  DEV_IDEA_STATUSES,
  DEV_IDEA_TYPE_LABELS,
  DEV_IDEA_LIFECYCLE_LABELS,
  DevIdeaStatusEnum,
  DevIdeaTypeEnum,
  DevIdeaLifecycleEnum,
} from "./dev-idea-service";

export type {
  CreateDevIdeaInput,
  UpdateDevIdeaInput,
  ListDevIdeasOptions,
  DevIdea,
  DevIdeaStatus,
  DevIdeaType,
  DevIdeaLifecycle,
  DevIdeaChatMessage,
  DevIdeaChatRole,
} from "./dev-idea-service";

export {
  parseFeatureMatrixOverviewTable,
  parseFeatureMatrixUpsertCandidates,
  rowToUpsertCandidate,
  loadFeatureMatrixMarkdown,
  syncFeatureMatrixToDevIdeas,
  maturityToLifecycle,
  FEATURE_MATRIX_ENRICHMENT,
} from "./feature-matrix-sync-service";

export type {
  FeatureMatrixRow,
  FeatureMatrixUpsertCandidate,
  FeatureMatrixSyncResult,
} from "./feature-matrix-sync-service";

export {
  createBugReportService,
  BugReportService,
  BUG_REPORT_STATUS_LABELS,
  BUG_REPORT_SEVERITY_LABELS,
  BugReportStatusEnum,
  BugReportSeverityEnum,
} from "./bug-report-service";

export type {
  CreateBugReportInput,
  UpdateBugReportInput,
  ListBugReportsOptions,
  BugReport,
  BugReportStatus,
  BugReportSeverity,
} from "./bug-report-service";

export {
  createMiniatureCollectionService,
  MiniatureCollectionService,
  MINIATURE_COLLECTION_STATUS_LABELS,
  MiniatureCollectionStatusEnum,
} from "./miniature-collection-service";

export type {
  CreateMiniatureCollectionItemInput,
  UpdateMiniatureCollectionItemInput,
  ListMiniatureCollectionOptions,
  MiniatureCollectionItem,
  MiniatureCollectionStatus,
} from "./miniature-collection-service";

export {
  createImportJobService,
  ImportJobService,
  IMPORT_JOB_STATUS_LABELS,
  IMPORT_SOURCE_TYPE_LABELS,
  IMPORT_TARGET_TYPE_LABELS,
  ImportJobStatusEnum,
  ImportSourceTypeEnum,
  ImportTargetTypeEnum,
} from "./import-job-service";

export type {
  CreateImportJobInput,
  UpdateImportJobInput,
  ListImportJobsOptions,
  ImportJob,
  ImportJobStatus,
  ImportSourceType,
  ImportTargetType,
} from "./import-job-service";

export {
  executeMarkdownImport,
  previewMarkdownImport,
  previewPdfImport,
  executePdfImport,
  ImportCentralError,
  PDF_NOT_SUPPORTED_MESSAGE,
} from "./import-central-service";

export type {
  MarkdownImportContext,
  MarkdownImportPreviewItem,
  MarkdownImportPreviewResult,
  MarkdownImportExecuteResult,
} from "./import-central-service";

export {
  extractObsidianVaultMarkdown,
  isObsidianVaultMarkdownEntry,
  ObsidianVaultImportError,
} from "./obsidian-vault-import";

export type { ObsidianVaultExtractResult } from "./obsidian-vault-import";

export {
  createDocumentTemplateService,
  DocumentTemplateService,
  DOCUMENT_TEMPLATE_CATEGORY_LABELS,
  DOCUMENT_TEMPLATE_BRAIN_CATEGORY,
  DocumentTemplateCategoryEnum,
  extractDocumentTemplateVariables,
  normalizeDocumentTemplateVariables,
  fillDocumentTemplate,
  MissingTemplateVariablesError,
} from "./document-template-service";

export type {
  CreateDocumentTemplateInput,
  UpdateDocumentTemplateInput,
  ListDocumentTemplatesOptions,
  DocumentTemplate,
  DocumentTemplateCategory,
  FillDocumentTemplateInput,
  FillDocumentTemplateOptions,
  FilledDocumentTemplate,
} from "./document-template-service";

export { buildDocumentPrintHtml, buildDocumentPrintStyles } from "./document-print-export";
export type { DocumentPrintInput } from "./document-print-export";

export {
  ConnectorService,
  createConnectorService,
  toConnectorView,
  waitForConnectorJob,
  ConnectorJobWaitError,
} from "./connector-service";

export type {
  Connector,
  ConnectorJob,
  ConnectorView,
  ConnectorModelInfo,
  ConnectorSummary,
  CreatedConnector,
  HeartbeatInput,
  EnqueueConnectorJobInput,
  ClaimJobInput,
  WaitForConnectorJobOptions,
} from "./connector-service";

export {
  ConnectorWorkflowService,
  createConnectorWorkflowService,
  ConnectorWorkflowValidationError,
  CONNECTOR_WORKFLOW_SLOTS,
  CONNECTOR_WORKFLOW_SLOT_LABELS,
  isConnectorWorkflowSlot,
  pickerModelId,
} from "./connector-workflow-service";

export type {
  ConnectorWorkflowSlot,
  ConnectorPickerModel,
  ConnectorWorkflowDefaultView,
} from "./connector-workflow-service";

export {
  createImageStudioService,
  ImageStudioService,
  createDndApiService,
  DndApiService,
  resolveImageStudioConfig,
  resolveImageStudioConfigStatus,
  resolveDndApiConfig,
  resolveCalendarConfig,
  IMAGE_STUDIO_OPERATION_LABELS,
  IMAGE_STUDIO_STATUS_LABELS,
  imageStudioStatusBadgeClass,
  extractImageStudioErrorMessage,
  ImageStudioOperationEnum,
  ImageStudioStatusEnum,
  ImageStudioLinkTargetTypeEnum,
  DndApiProviderEnum,
} from "./integrations-service";

export type {
  CreateImageStudioProjectInput,
  CreateImageStudioVersionInput,
  ImageStudioProject,
  ImageStudioVersion,
  ImageStudioLink,
  ImageStudioOperation,
  ImageStudioStatus,
  ImageStudioLinkTargetType,
  DndApiProvider,
  DndBeyondReference,
  DndApiCacheEntry,
  ImageStudioConfig,
  ImageStudioConfigStatus,
  ImageStudioPortalOverrides,
  DndApiConfig,
  CalendarIntegrationConfig,
} from "./integrations-service";

export { createMailComposeService, MailComposeService } from "./mail-compose-service";

export { createMailAccountService, MailAccountService } from "./mail-account-service";
export { createMailPortalService, MailPortalService } from "./mail-portal-service";
export { scoreMailPriority } from "./mail-priority-service";
export type { CreateMailAccountInput, CreateMailDraftInput } from "./mail-account-service";

export {
  createInferenceEndpointService,
  InferenceEndpointService,
  assertInferenceEndpointUrlAllowed,
  estimateHardwareFit,
} from "./inference-endpoint-service";

export type {
  InferenceEndpointRecord,
  CreateInferenceEndpointInput,
  ProbeResult,
} from "./inference-endpoint-service";

export { createPageVersionService, PageVersionService } from "./page-version-service";
export type { PageVersionRecord } from "./page-version-service";

export { createResearchService, ResearchService, assertResearchQuerySafe } from "./research-service";
export type { StartResearchInput } from "./research-service";

export {
  AiGatewayService,
  createAiGatewayService,
  AiGatewayAccessDeniedError,
  AiGatewayBudgetExceededError,
  AiGatewayDisabledError,
  AI_FEATURE_PERMISSIONS,
  AI_FEATURE_PERMISSION_LABELS,
  MASTER_ADMIN_PERMISSIONS,
  DEFAULT_PRIVACY_RULES, AI_FEATURE_MODEL_KEYS, AI_FEATURE_MODEL_LABELS,
  resolveFeatureCategory, resolveRequiredPermission, isMasterAdminRole, resolveFeatureModelOverride,
} from "./ai-gateway-service";
export type {
  AiRoutingMode,
  AiPrivacyLevel,
  AiFeatureCategory,
  AiFeaturePermission,
  AiGatewayConfigRecord, AiFeatureModelConfig, AiFeatureModels, AiCloudProviderRecord,
  AiUserGrantRecord,
  AiUsageLogRecord,
  AiBudgetStatus,
  CreateUsageLogInput,
  UpsertCloudProviderInput,
  UpsertUserGrantInput,
} from "./ai-gateway-service";

export {
  createAtlasService,
  isAtlasEntityAccessible,
  type AtlasService,
  type AtlasEntityAccessRecord,
  type CreateAtlasMapInput,
  type UpdateAtlasMapInput,
  type CreateAtlasNodeInput,
  type UpdateAtlasNodeInput,
  type CreateAtlasFeatureInput,
  type UpdateAtlasFeatureInput,
  type CreateAtlasObjectInput,
  type UpdateAtlasObjectInput,
  type CreateAtlasPaletteItemInput,
  type NodeAncestor,
  type NodeWithHierarchy,
} from "./atlas-service";

export type {
  AtlasMap as DbAtlasMap,
  AtlasNode as DbAtlasNode,
  AtlasFeature as DbAtlasFeature,
  AtlasObject as DbAtlasObject,
  AtlasPaletteItem as DbAtlasPaletteItem,
  AtlasNodeLevel,
  AtlasFeatureKind,
  AtlasLabelColor,
  AtlasPaletteSource,
  AtlasPaletteReviewStatus,
} from "./generated/prisma/client";
