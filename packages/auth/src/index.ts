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
  buildAccessContext,
  canChangeVisibility,
  canEditContent,
  canPreviewAsPlayer,
  canPublishContent,
  canViewAsset,
  canViewContentBlock,
  canViewPage,
  filterAssetsForViewer,
  filterBlocksForViewer,
  filterPagesForViewer,
  isDmOrOwner,
  resolveEffectiveRole,
} from "./permissions";

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
  getSessionCookieOptions,
  getTrustedRequestHosts,
  getUweRuntimeConfig,
  isProductionEnv,
  isPublicExposureConfigured,
  originMatchesTrustedHost,
} from "./runtime-config";

export { resolveClientIp } from "./proxy";

export const AUTH_PACKAGE_VERSION = "0.2.0";
