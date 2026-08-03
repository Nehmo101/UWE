export type {
  AccessContext,
  AreaAccess,
  AuthUser,
  AuthUserSource,
  PreviewOptions,
  SafeUser,
  UweArea,
  WorldMembership,
} from "./types";

export { NO_AREA_ACCESS, UWE_AREAS } from "./types";

export { toSafeUser, stripSensitiveUserFields } from "./safe-user";

export {
  AiAccessDeniedError,
  AuthRequiredError,
  ForbiddenAccessError,
  UWE_AREA_LABELS,
  canAccessBrain,
  canAccessFamily,
  canAccessPortal,
  canAccessStudio,
  canUseEngineAi,
  getRequiredAccessForApiPath,
  getRequiredAccessForPagePath,
  hasAreaAccess,
  isAiStudioApiPath,
  isAiStudioPagePath,
  isOwner,
  requireArea,
  requireOwner,
  requireEngineAi,
  requireUser,
  satisfiesStudioRouteAccess,
  toAreaAccess,
  toAuthUser,
} from "./area-access";

export type { StudioRouteAccess } from "./area-access";

export {
  buildAccessContext,
  canEditContent as canEditContentRole,
  canPreviewAsPlayer,
  canReadDmSections,
  canSeeUnreleasedPages,
  canViewAuditLog,
  canViewWorldContent,
  filterAssetsForViewer,
  filterBlocksForViewer,
  filterPagesForViewer,
  isDm,
  isOwner as isContextOwner,
  redactDmSectionsForViewer,
} from "./permissions";

export type { DmSectionRange, DmSegment } from "./dm-section";
export {
  DM_SECTION_CLOSE,
  DM_SECTION_OPEN,
  extractDmSections,
  findDmSections,
  hasDmSection,
  preserveDmSections,
  splitDmSegments,
  stripDmSections,
} from "./dm-section";

export type {
  AIUsageContext,
  AuthzScope,
  ContentAuthTarget,
  MediaUploadTarget,
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
  assertCanUploadMedia,
  assertCanUseAI,
  canEditContent,
  canReadAsset,
  canReadContent,
  canReadContentBlock,
  canReadWorld,
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

export { canEditPlayerCharacterBlock } from "./player-character-permissions";

export type { TerraKarteAccessInfo } from "./terra-karte-permissions";
export {
  canCreateTerraKarte,
  canDeleteTerraKarte,
  canEditTerraKarte,
  canSubmitTerraKarte,
  canViewTerraKarte,
  canWithdrawTerraKarte,
} from "./terra-karte-permissions";

export {
  DEFAULT_SESSION_TTL_MS,
  PREVIEW_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  readSessionTokensFromCookieHeader,
  sessionExpiresAt,
} from "./session";

export type { SessionCookieOptions, SessionCookieSameSite, UweRuntimeConfig } from "./runtime-config";
export {
  getAllowedCorsOrigins,
  getOAuthStateCookieOptions,
  getSessionCookieClearVariants,
  getSessionCookieOptions,
  getSessionCookieOptionsForRequest,
  getTrustedRequestHosts,
  getUweDeploymentModel,
  getUweRuntimeConfig,
  isProductionEnv,
  isPublicExposureConfigured,
  isRequestSecure,
  isSplitHostnameDeployment,
  originMatchesTrustedHost,
  rebaseUrlOnPublicOrigin,
  resolveCrossAppUrls,
  resolveUweAppUrls,
  resolvePortalPublicBaseUrl,
  resolvePortalSessionHref,
  resolvePortalLoginHref,
  resolveBrainPublicBaseUrl,
  resolveFamilyPublicBaseUrl,
  resolveLandingPublicBaseUrl,
  resolveStudioPublicBaseUrl,
  resolveStudioSessionHref,
  STUDIO_SESSION_ENTRY_PATH,
} from "./runtime-config";

export type { UweAppUrls, UweCrossAppUrls, UweDeploymentModel } from "./runtime-config";

export {
  getRuntimeEnvOverrides,
  setRuntimeEnvOverrides,
  withRuntimeEnvOverrides,
} from "./runtime-env-overrides";

export type { EnvValidationIssue, EnvValidationSeverity } from "./env-validation";
export {
  BlockingEnvError,
  enforceEnvSafetyAtBoot,
  hasBlockingEnvIssues,
  validateUweEnvironment,
} from "./env-validation";

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
  shouldSendStrictTransportSecurityForRequest,
  wantsStrictTransportSecurity,
} from "./security-headers";

export type { CspReviewFinding, CspReviewSeverity } from "./csp-review";
export {
  analyzeCspLooseningRisks,
  reviewCspPolicy,
  validateCspPolicyInput,
} from "./csp-review";

export { resolveClientIp } from "./proxy";

export type { TurnstileConfig, TurnstileVerifyResult, VerifyTurnstileOptions } from "./turnstile";
export {
  TURNSTILE_SCRIPT_ORIGIN,
  TURNSTILE_SCRIPT_URL,
  TURNSTILE_VERIFY_ENDPOINT,
  getTurnstileConfig,
  isTurnstileEnabled,
  verifyTurnstileToken,
} from "./turnstile";

export {
  API_TOKEN_PREFIX,
  API_TOKEN_PREFIX_DISPLAY_LENGTH,
  API_TOKEN_SCOPES,
  API_TOKEN_SCOPE_LABELS,
  assertAdminScopesForOwner,
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
  requireOwnerAccess,
  requireStudioAccess,
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
export { authorize, authorizeForSurface } from "./security/authorize";

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
  BRAIN_PUBLIC_ROUTES,
  FAMILY_PUBLIC_ROUTES,
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
  evaluateBrainMiddleware,
  evaluateFamilyMiddleware,
  getMiddlewareMatcher,
} from "./security/middleware";

export {
  fetchMaintenanceMiddlewareDecision,
  MAINTENANCE_EVALUATE_API_PATH,
} from "./security/maintenance-middleware";

export type { MaintenanceMiddlewareDecision } from "./security/maintenance-middleware";

export type { LegacyPathRedirect } from "./legacy-path-redirects";
export { resolveLegacyPathRedirect } from "./legacy-path-redirects";

export type {
  TwoFactorAuditAction,
  TwoFactorAuditEvent,
  TwoFactorAuditRequestContext,
  TwoFactorDbHandle,
  TwoFactorRateLimitOptions,
  TwoFactorRateLimitResult,
  TwoFactorRouteDeps,
  TwoFactorRouteHandlers,
  TwoFactorRouteUser,
  TwoFactorServicePort,
} from "./two-factor-routes";
export { createTwoFactorRouteHandlers } from "./two-factor-routes";

export type {
  CompleteTwoFactorLoginDeps,
  ExistingLoginUser,
  IssueLoginSessionDeps,
  LoginAttemptAuditInput,
  LoginAuditRequestContext,
  LoginAuthServicePort,
  LoginDbHandle,
  LoginFlowFailureReason,
  LoginFlowSurface,
  LoginFlowUser,
  LoginRateLimitOptions,
  LoginRateLimitResult,
  LoginTurnstileResult,
  LoginTwoFactorServicePort,
  PerformLoginFlowDeps,
  ResolveLoginFailureInput,
  SessionIssuingAuthPort,
  TwoFactorSuccessContext,
} from "./login-flow";
export {
  buildAuthSuccessBody,
  completeTwoFactorLogin,
  issueLoginSession,
  performLoginFlow,
} from "./login-flow";

export const AUTH_PACKAGE_VERSION = "0.2.0";
