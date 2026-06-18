export type {
  AccessContext,
  AssetAccessInfo,
  AuthUser,
  ContentBlockAccessInfo,
  PageAccessInfo,
  PreviewOptions,
  UweRole,
  WorldMemberRole,
  WorldMembership,
  PageVisibility,
} from "./types";

export {
  ADMIN_ACCESS_ROLES,
  AuthRequiredError,
  ForbiddenRoleError,
  STUDIO_ACCESS_ROLES,
  canAccessAdmin,
  canAccessStudio,
  getRequiredRolesForApiPath,
  getRequiredRolesForPagePath,
  hasAnyRole,
  isContentEditorRole,
  isOwner,
  requireOwner,
  requireRole,
  requireUser,
} from "./roles";

export type { AdminAccessRole, StudioAccessRole } from "./roles";

export {
  SECURITY_DASHBOARD_ROLES,
  SECURITY_ROLE_LABELS,
  canAccessSecurityDashboard,
  isSecurityDashboardRole,
} from "./security-access";

export {
  buildAccessContext,
  canChangeVisibility,
  canEditContent as canEditContentRole,
  canPreviewAsPlayer,
  canPublishContent,
  canViewAsset,
  canViewAuditLog,
  canViewContentBlock,
  canViewPage,
  filterAssetsForViewer,
  filterBlocksForViewer,
  filterPagesForViewer,
  isDmOrOwner,
  resolveEffectiveRole,
} from "./permissions";

export {
  detectPrivateReferences,
  formatPrivateReferenceWarning,
  isBlockPlayerExposable,
  isDmOnlyVisibility,
  isPagePlayerExposable,
  isPlayerExposableContent,
  isPlayerPortalVisibility,
  isPublishedContentStatus,
  isSecretVisibleToPlayer,
  mapPublishStatusToContentStatus,
  PLAYER_PORTAL_VISIBILITIES,
  type ContentAccessFields,
  type ContentBlockAccessFields,
  type ContentStatus,
  type ContentVisibility,
  type PrivateReferenceTarget,
  type RevealState,
  type SecretLevel,
} from "./content-access";

export type {
  AIUsageContext,
  AuthzScope,
  ContentAuthTarget,
  MediaUploadTarget,
  SecretAuthTarget,
  WorldAuthTarget,
} from "./security/authz";

export {
  AuthorizationError,
  assertCanEditContent,
  assertCanEditContentWithContext,
  assertCanEditWorld,
  assertCanReadContent,
  assertCanReadContentWithContext,
  assertCanReadWorld,
  assertCanReadWorldWithContext,
  assertCanRevealSecret,
  assertCanUploadMedia,
  assertCanUseAI,
  canEditContent,
  canReadAsset,
  canReadContent,
  canReadContentBlock,
  canReadWorld,
  canRevealSecret,
  canUploadMedia,
  canUseAI,
  scopeFromAccessContext,
} from "./security/authz";

export type {
  PlayerNoteAccessInfo,
  PlayerNoteStatus,
  PlayerNoteVisibility,
} from "./player-note-permissions";

export {
  canCreatePlayerNote,
  canEditPlayerNote,
  canModeratePlayerNote,
  canViewPlayerNote,
  filterPlayerNotesForViewer,
} from "./player-note-permissions";

export {
  DEFAULT_SESSION_TTL_MS,
  PREVIEW_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  sessionExpiresAt,
} from "./session";

export type { SessionCookieOptions, SessionCookieSameSite, UweRuntimeConfig } from "./runtime-config";
export {
  getAllowedCorsOrigins,
  getOAuthStateCookieOptions,
  getSessionCookieOptions,
  getTrustedRequestHosts,
  getUweRuntimeConfig,
  isProductionEnv,
  isPublicExposureConfigured,
  originMatchesTrustedHost,
} from "./runtime-config";

export type { EnvValidationIssue, EnvValidationSeverity } from "./env-validation";
export { hasBlockingEnvIssues, validateUweEnvironment } from "./env-validation";

export type { ApiOriginGuardResult } from "./api-origin-guard";
export {
  assessApiOrigin,
  isCrossSiteBrowserRequest,
  isSameOriginBrowserRequest,
} from "./api-origin-guard";

export type { SecurityHeader, SecurityHeaderOptions } from "./security-headers";
export {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  getUweSecurityHeaderEntries,
  getUweSecurityHeaders,
} from "./security-headers";

export { resolveClientIp } from "./proxy";

export {
  API_TOKEN_PREFIX,
  API_TOKEN_PREFIX_DISPLAY_LENGTH,
  API_TOKEN_SCOPES,
  API_TOKEN_SCOPE_LABELS,
  assertAdminScopesForRole,
  getApiTokenPrefix,
  hasApiTokenScope,
  isApiTokenFormat,
  maskSecretValue,
  maskTokenForDisplay,
  parseBearerToken,
  type ApiTokenScope,
} from "./api-token";

export {
  evaluateAdminGate,
  isAdminRole,
  requireAdminRole,
  requirePlayerBlocked,
  requireStudioRole,
  type AdminGateContext,
  type AdminGateDenied,
  type AdminGateResult,
} from "./admin-gate";

export type {
  AuthorizeDenied,
  AuthorizeInput,
  AuthorizeResult,
  AuthorizeScope,
} from "./security/authorize";
export { authorize, authorizeForSurface, hasCloudflareAccessAuth } from "./security/authorize";

export type {
  RouteAccess,
  RouteClassification,
  UweAppSurface,
} from "./security/route-policy";
export {
  PUBLIC_ASSET_ROUTES,
  PUBLIC_PLAYER_APP_ROUTES,
  PUBLIC_PORTAL_API_ROUTES,
  PUBLIC_STUDIO_API_ROUTES,
  PROTECTED_ROUTE_PREFIXES,
  classifyRoute,
  isApiRoute,
  isGuestWikiPath,
  isPublicRoute,
  isUnknownProtectedApi,
  matchesRoutePattern,
  normalizePathname,
  requiresPortalSession,
  requiresStudioAuth,
} from "./security/route-policy";

export type { MiddlewareDecision, MiddlewareRequestLike } from "./security/middleware";
export {
  evaluatePortalMiddleware,
  evaluateStudioMiddleware,
  getMiddlewareMatcher,
} from "./security/middleware";

export const AUTH_PACKAGE_VERSION = "0.2.0";
