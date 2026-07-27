/**
 * The four areas a person can be let into. One checkbox each, set by the owner
 * in the Command Center — there is no self-service registration.
 */
export type UweArea = "portal" | "studio" | "brain" | "family";

export const UWE_AREAS = ["portal", "studio", "brain", "family"] as const satisfies readonly UweArea[];

/** Which of the four areas an address is allowed to enter. */
export type AreaAccess = Record<UweArea, boolean>;

export const NO_AREA_ACCESS: AreaAccess = {
  portal: false,
  studio: false,
  brain: false,
  family: false,
};

export interface AuthUser {
  id: string;
  displayName: string;
  email: string | null;
  /** Operations, restore and the Command Center. The one role that is left. */
  isOwner: boolean;
  access: AreaAccess;
}

/**
 * Anything an {@link AuthUser} can be built from: a raw `User` row with its four
 * `*Access` columns, or a user object that already carries a shaped `access`.
 * Missing flags read as `false` — the permissive shape stays fail-closed.
 */
export interface AuthUserSource {
  id: string;
  displayName: string;
  email: string | null;
  isOwner: boolean;
  access?: AreaAccess | null;
  portalAccess?: boolean | null;
  studioAccess?: boolean | null;
  brainAccess?: boolean | null;
  familyAccess?: boolean | null;
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

/**
 * A world assignment. No role values: it says that person X belongs to world Y,
 * nothing more. What they may do there follows from their Studio checkbox.
 */
export interface WorldMembership {
  userId: string;
  worldId: string;
  characterName: string | null;
}

/**
 * Runtime access context for permission checks in Studio or Portal.
 * Built from the authenticated user, world membership, and optional preview mode.
 */
export interface AccessContext {
  user: AuthUser | null;
  worldMembership: WorldMembership | null;
  /** When set, a Studio user views content as this player would see it. */
  previewAsUserId: string | null;
}

export interface PreviewOptions {
  previewAsUserId?: string | null;
}
