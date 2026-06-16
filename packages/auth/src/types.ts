/** Global user role (system-wide default). */
export type UweRole = "owner" | "admin" | "dm" | "player" | "readonly" | "guest";

/** Role within a specific world. */
export type WorldMemberRole = "owner" | "dm" | "player";

export type PageVisibility =
  | "private"
  | "dm_only"
  | "player_visible"
  | "public"
  | "specific_players"
  | "unlock_after_session"
  | "archived";

export interface AuthUser {
  id: string;
  displayName: string;
  email: string | null;
  role: UweRole;
}

export interface WorldMembership {
  userId: string;
  worldId: string;
  role: WorldMemberRole;
  characterName: string | null;
}

export interface PageAccessInfo {
  id: string;
  visibility: PageVisibility;
  publishStatus: string;
  secretLevel?: "none" | "spoiler" | "dm_secret" | null;
  revealState?: "hidden" | "preview" | "revealed" | null;
}

export interface ContentBlockAccessInfo {
  visibility: PageVisibility;
  type?: string;
  secretLevel?: "none" | "spoiler" | "dm_secret" | null;
  revealState?: "hidden" | "preview" | "revealed" | null;
}

export interface AssetAccessInfo {
  id: string;
  visibility: PageVisibility;
  secretLevel?: "none" | "spoiler" | "dm_secret" | null;
  revealState?: "hidden" | "preview" | "revealed" | null;
  /** Page IDs linked to this asset (for specific_players / unlock_after_session). */
  linkedPageIds?: string[];
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
  /** Page IDs unlocked for the effective viewer via session unlocks. */
  unlockedPageIds: ReadonlySet<string>;
  /** Page IDs the effective viewer may access via specific_players grants. */
  specificPlayerPageIds: ReadonlySet<string>;
}

export interface PreviewOptions {
  previewAsUserId?: string | null;
}
