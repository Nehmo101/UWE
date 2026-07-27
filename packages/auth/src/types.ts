/** Global user role (system-wide default). */
export type UweRole = "owner" | "admin" | "dm" | "player" | "readonly" | "guest";

/** Role within a specific world. */
export type WorldMemberRole = "owner" | "dm" | "co_dm" | "player";

export interface AuthUser {
  id: string;
  displayName: string;
  email: string | null;
  role: UweRole;
}

/** User record safe for API/UI responses — never includes secrets or hashes. */
export interface SafeUser extends AuthUser {
  createdAt?: string;
  updatedAt?: string;
  forcePasswordChange?: boolean;
  status?: "invited" | "active" | "disabled";
  emailVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  /** Whether a password is configured (never exposes the hash). */
  hasPassword?: boolean;
}

export interface WorldMembership {
  userId: string;
  worldId: string;
  role: WorldMemberRole;
  characterName: string | null;
}

/**
 * Runtime access context for permission checks in Studio or Portal.
 * Built from the authenticated user, world membership, and optional preview mode.
 */
export interface AccessContext {
  user: AuthUser | null;
  worldMembership: WorldMembership | null;
  /** Effective role after applying preview-as-player overrides. */
  effectiveRole: UweRole;
  guestModeEnabled: boolean;
  /** When set, DM/owner views content as this player would see it. */
  previewAsUserId: string | null;
}

export interface PreviewOptions {
  previewAsUserId?: string | null;
}
