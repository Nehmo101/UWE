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

export { hashPassword, verifyPassword } from "./password";

export {
  DEFAULT_SESSION_TTL_MS,
  generateSessionToken,
  PREVIEW_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  sessionExpiresAt,
} from "./session";

export const AUTH_PACKAGE_VERSION = "0.2.0";
