export {
  apiError,
  csrfError,
  forbidden,
  rateLimitError,
  safeHandlerError,
  unauthorized,
  validationError,
  type ApiErrorBody,
} from "./security/errors";

export {
  parseBody,
  parseFormData,
  parseFormDataOrThrow,
  parseParams,
  parseQuery,
  type ParseFailure,
  type ParseResult,
  type ParseSuccess,
} from "./security/validate";

export {
  isCrossSiteBrowserRequest,
  isSameOriginBrowserRequest,
  requireSameOrigin,
  requireSameOriginMutation,
} from "./security/csrf";

export {
  handleSameOriginPreflight,
  sameOriginCorsHeaders,
} from "./security/cors";

export {
  RATE_LIMITER_MODE,
  RATE_LIMIT_PRESETS,
  checkRateLimit,
  checkRateLimitAsync,
  clientIpFromHeaders,
  enforceRateLimit,
  getRateLimitStore,
  getAsyncRateLimitStore,
  resetRateLimit,
  resetRateLimitAsync,
  resetRateLimitStore,
  setRateLimitStore,
  setAsyncRateLimitStore,
  createDefaultRateLimitStore,
  type AsyncRateLimitStore,
  type RateLimitOptions,
  type RateLimitPreset,
  type RateLimitResult,
  type RateLimitStore,
} from "./security/rate-limit";

export { bootstrapRateLimitStore } from "./security/bootstrap-rate-limit";
export { createRedisRateLimitStore } from "./security/redis-rate-limit-store";

export {
  guardStudioMutation,
  requireAdminApiAuth,
  requireOwnerApiAuth,
  requirePortalApiAuth,
  requirePortalReadAuth,
  requireRestoreOwnerAuth,
  requireStudioApiAuth,
  requireStudioRoleApiAuth,
  type AdminGuardOptions,
  type ApiAuthContext,
  type PortalGuardOptions,
  type StudioGuardOptions,
} from "./security/guards";

export {
  requireFamilyApiAuthContext,
  type FamilyGuardOptions,
} from "./security/family-guards";

export * from "./schemas/common";
export * from "./schemas/actions";

export {
  canUseAi,
  requireAiRole,
  resolveAiPolicyLimits,
  checkAiRateLimit,
  resetAiRateLimit,
  validatePromptLength,
  validateContextSize,
  validateMaxOutputTokens,
  assertModelAllowed,
  enforceAiRequestLimits,
  enforceAiAccessPolicy,
  sanitizeAiResponseForClient,
  type AiAccessContext,
  type AiRequestLimitsInput,
} from "./security/ai-policy";

export {
  redactAiSecrets,
  truncatePromptForLog,
  formatAiPromptLog,
  sanitizeAiLogPayload,
  shouldLogAiPrompts,
  resolvePromptLogMaxChars,
} from "./security/ai-logging";

export {
  assertFetchUrlAllowed,
  assertUserProvidedFetchUrlAllowed,
  isBlockedUserFetchTarget,
  resolveAiFetchAllowlist,
  SsrfBlockedError,
} from "./security/ssrf-guard";

export {
  rejectClientWorkerUrl,
  resolveEngineBaseUrl,
  resolveEngineWorkerBoundary,
  buildEngineWorkerAuthHeaders,
  verifyEngineHmacSignature,
  fetchEngineWorker,
  toEngineWorkerConfig,
  toEngineAgentConfig,
  EngineBoundaryError,
  type EngineWorkerBoundaryConfig,
  type EngineWorkerRequestOptions,
} from "./security/engine-boundary";

export { AiAccessDeniedError, AiPolicyViolationError } from "./security/errors";

export const SECURITY_PACKAGE_VERSION = "0.1.0";
