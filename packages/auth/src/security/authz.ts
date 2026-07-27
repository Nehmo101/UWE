import {
  buildAccessContext,
  canViewAsset,
  canViewContentBlock,
  canViewPage,
  isDmOrOwner,
} from "../permissions";
import type {
  AccessContext,
  AssetAccessInfo,
  AuthUser,
  ContentBlockAccessInfo,
  PageAccessInfo,
  PageVisibility,
  WorldMembership,
} from "../types";

/** Thrown when an authorization check fails. */
export class AuthorizationError extends Error {
  readonly statusCode: 401 | 403;

  constructor(message: string, statusCode: 401 | 403 = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
  }
}

const KNOWN_VISIBILITIES: ReadonlySet<PageVisibility> = new Set([
  "dm_only",
  "player_visible",
  "public",
  "specific_players",
  "unlock_after_session",
  "archived",
]);

const DM_WORLD_ROLES: ReadonlySet<WorldMembership["role"]> = new Set(["owner", "dm"]);

/** World target for authorization checks — membership is the requesting user's role in this world. */
export interface WorldAuthTarget {
  id: string;
  guestModeEnabled: boolean;
  /** Requesting user's membership in this world, or null if none. */
  membership: WorldMembership | null;
}

/** Content (page) target for authorization checks. */
export interface ContentAuthTarget {
  id: string;
  visibility: string;
  type?: string;
}

/** Secret page target — same shape as content, type should be "secret". */
export type SecretAuthTarget = ContentAuthTarget & { type: "secret" };

/** Media upload target scoped to a world. */
export interface MediaUploadTarget {
  worldId: string;
  membership?: WorldMembership | null;
}

/** AI usage context for feature gating. */
export interface AIUsageContext {
  worldId?: string;
  membership?: WorldMembership | null;
  includesBrainData?: boolean;
  includesPrivateContent?: boolean;
}

/** Optional scope modifiers for authorization checks. */
export interface AuthzScope {
  unlockedPageIds?: Iterable<string>;
  specificPlayerPageIds?: Iterable<string>;
  previewAsUserId?: string | null;
  /** Studio runs behind network trust — grants DM-equivalent access. */
  studioTrusted?: boolean;
}

function normalizeVisibility(visibility: string): PageVisibility | null {
  return KNOWN_VISIBILITIES.has(visibility as PageVisibility)
    ? (visibility as PageVisibility)
    : null;
}

function toPageAccessInfo(content: ContentAuthTarget): PageAccessInfo | null {
  const visibility = normalizeVisibility(content.visibility);
  if (!visibility) {
    return null;
  }
  return { id: content.id, visibility };
}

function isGlobalOwner(user: AuthUser | null): boolean {
  return user?.role === "owner";
}

function isGlobalDm(user: AuthUser | null): boolean {
  return user?.role === "owner" || user?.role === "admin" || user?.role === "dm";
}

function hasDmWorldRole(membership: WorldMembership | null | undefined): boolean {
  return membership !== null && membership !== undefined && DM_WORLD_ROLES.has(membership.role);
}

function isGlobalAdmin(user: AuthUser | null): boolean {
  return user?.role === "owner" || user?.role === "admin";
}

function toAccessContext(
  user: AuthUser | null,
  world: WorldAuthTarget,
  scope?: AuthzScope,
): AccessContext {
  return buildAccessContext({
    user,
    worldMembership: membershipForUser(user, world),
    guestModeEnabled: world.guestModeEnabled,
    unlockedPageIds: scope?.unlockedPageIds,
    specificPlayerPageIds: scope?.specificPlayerPageIds,
    preview: scope?.previewAsUserId ? { previewAsUserId: scope.previewAsUserId } : undefined,
  });
}

/** Build an AuthzScope from an existing AccessContext. */
export function scopeFromAccessContext(
  ctx: AccessContext,
  worldId: string,
): AuthzScope & { world: WorldAuthTarget } {
  return {
    world: {
      id: worldId,
      guestModeEnabled: ctx.guestModeEnabled,
      membership: ctx.worldMembership,
    },
    unlockedPageIds: ctx.unlockedPageIds,
    specificPlayerPageIds: ctx.specificPlayerPageIds,
    previewAsUserId: ctx.previewAsUserId,
  };
}

function membershipForUser(
  user: AuthUser | null,
  world: WorldAuthTarget,
): WorldMembership | null {
  if (!user || !world.membership || world.membership.userId !== user.id) {
    return null;
  }
  return world.membership;
}

export function canReadWorld(
  user: AuthUser | null,
  world: WorldAuthTarget,
  scope?: Pick<AuthzScope, "studioTrusted">,
): boolean {
  if (scope?.studioTrusted || isGlobalOwner(user)) {
    return true;
  }

  if (isGlobalDm(user)) {
    return true;
  }

  if (membershipForUser(user, world)) {
    return true;
  }

  if (!world.guestModeEnabled) {
    return false;
  }

  return true;
}

export function canEditWorld(
  user: AuthUser | null,
  world: WorldAuthTarget,
  scope?: Pick<AuthzScope, "studioTrusted">,
): boolean {
  if (scope?.studioTrusted || isGlobalOwner(user)) {
    return true;
  }

  if (user?.role === "dm") {
    return true;
  }

  // Admin manages system but does not auto-edit world canon without world DM role.
  if (isGlobalAdmin(user)) {
    return false;
  }

  return hasDmWorldRole(membershipForUser(user, world));
}

export function canReadContent(
  user: AuthUser | null,
  content: ContentAuthTarget,
  world: WorldAuthTarget,
  scope?: AuthzScope,
): boolean {
  if (scope?.studioTrusted || isGlobalOwner(user)) {
    return true;
  }

  if (!canReadWorld(user, world, scope)) {
    return false;
  }

  const pageInfo = toPageAccessInfo(content);
  if (!pageInfo) {
    return false;
  }

  const ctx = toAccessContext(user, world, scope);
  return canViewPage(ctx, pageInfo);
}

export function canEditContent(
  user: AuthUser | null,
  content: ContentAuthTarget,
  world: WorldAuthTarget,
  scope?: AuthzScope,
): boolean {
  if (scope?.studioTrusted || isGlobalOwner(user)) {
    return true;
  }

  if (!canEditWorld(user, world, scope)) {
    return false;
  }

  const membership = membershipForUser(user, world);
  if (membership?.role === "co_dm") {
    return false;
  }

  const ctx = toAccessContext(user, world, scope);
  return isDmOrOwner(ctx);
}

export function canReadContentBlock(
  user: AuthUser | null,
  block: ContentBlockAccessInfo & { visibility: string },
  content: ContentAuthTarget,
  world: WorldAuthTarget,
  scope?: AuthzScope,
): boolean {
  if (scope?.studioTrusted || isGlobalOwner(user)) {
    return true;
  }

  const pageInfo = toPageAccessInfo(content);
  if (!pageInfo) {
    return false;
  }

  const blockVisibility = normalizeVisibility(block.visibility);
  if (!blockVisibility) {
    return false;
  }

  const ctx = toAccessContext(user, world, scope);
  return canViewContentBlock(ctx, { visibility: blockVisibility }, pageInfo);
}

export function canRevealSecret(
  user: AuthUser | null,
  secret: SecretAuthTarget,
  world: WorldAuthTarget,
  scope?: AuthzScope,
): boolean {
  if (scope?.studioTrusted || isGlobalOwner(user)) {
    return true;
  }

  if (secret.type !== "secret") {
    return false;
  }

  return canReadContent(user, secret, world, scope);
}

export function canReadAsset(
  user: AuthUser | null,
  asset: AssetAccessInfo & { visibility: string },
  world: WorldAuthTarget,
  scope?: AuthzScope,
): boolean {
  if (scope?.studioTrusted || isGlobalOwner(user)) {
    return true;
  }

  if (!canReadWorld(user, world, scope)) {
    return false;
  }

  const visibility = normalizeVisibility(asset.visibility);
  if (!visibility) {
    return false;
  }

  const ctx = toAccessContext(user, world, scope);
  return canViewAsset(ctx, { ...asset, visibility });
}

export function canUploadMedia(
  user: AuthUser | null,
  target: MediaUploadTarget,
  scope?: Pick<AuthzScope, "studioTrusted">,
): boolean {
  const world: WorldAuthTarget = {
    id: target.worldId,
    guestModeEnabled: false,
    membership: target.membership ?? null,
  };
  return canEditWorld(user, world, scope);
}

export function canUseAI(
  user: AuthUser | null,
  context: AIUsageContext,
  scope?: Pick<AuthzScope, "studioTrusted">,
): boolean {
  if (scope?.studioTrusted || isGlobalOwner(user)) {
    return true;
  }

  if (user?.role === "dm") {
    return true;
  }

  if (hasDmWorldRole(context.membership)) {
    return true;
  }

  if (context.membership?.role === "co_dm") {
    return true;
  }

  if (context.includesBrainData || context.includesPrivateContent) {
    return false;
  }

  return false;
}

export function assertCanReadWorld(
  user: AuthUser | null,
  world: WorldAuthTarget,
  scope?: Pick<AuthzScope, "studioTrusted">,
): void {
  if (!canReadWorld(user, world, scope)) {
    throw new AuthorizationError("Keine Berechtigung zum Lesen dieser Welt", user ? 403 : 401);
  }
}

export function assertCanEditWorld(
  user: AuthUser | null,
  world: WorldAuthTarget,
  scope?: Pick<AuthzScope, "studioTrusted">,
): void {
  if (!canEditWorld(user, world, scope)) {
    throw new AuthorizationError("Keine Berechtigung zum Bearbeiten dieser Welt", user ? 403 : 401);
  }
}

export function assertCanReadContent(
  user: AuthUser | null,
  content: ContentAuthTarget,
  world: WorldAuthTarget,
  scope?: AuthzScope,
): void {
  if (!canReadContent(user, content, world, scope)) {
    throw new AuthorizationError("Keine Berechtigung zum Lesen dieses Inhalts", user ? 403 : 401);
  }
}

export function assertCanEditContent(
  user: AuthUser | null,
  content: ContentAuthTarget,
  world: WorldAuthTarget,
  scope?: AuthzScope,
): void {
  if (!canEditContent(user, content, world, scope)) {
    throw new AuthorizationError("Keine Berechtigung zum Bearbeiten dieses Inhalts", user ? 403 : 401);
  }
}

export function assertCanRevealSecret(
  user: AuthUser | null,
  secret: SecretAuthTarget,
  world: WorldAuthTarget,
  scope?: AuthzScope,
): void {
  if (!canRevealSecret(user, secret, world, scope)) {
    throw new AuthorizationError("Keine Berechtigung zum Anzeigen dieses Geheimnisses", user ? 403 : 401);
  }
}

export function assertCanUploadMedia(
  user: AuthUser | null,
  target: MediaUploadTarget,
  scope?: Pick<AuthzScope, "studioTrusted">,
): void {
  if (!canUploadMedia(user, target, scope)) {
    throw new AuthorizationError("Keine Berechtigung zum Hochladen von Medien", user ? 403 : 401);
  }
}

export function assertCanUseAI(
  user: AuthUser | null,
  context: AIUsageContext,
  scope?: Pick<AuthzScope, "studioTrusted">,
): void {
  if (!canUseAI(user, context, scope)) {
    throw new AuthorizationError("Keine Berechtigung zur KI-Nutzung", user ? 403 : 401);
  }
}

/** Assert read access using an existing AccessContext (portal convenience). */
export function assertCanReadContentWithContext(
  ctx: AccessContext,
  content: ContentAuthTarget,
  worldId: string,
): void {
  const { world, ...scope } = scopeFromAccessContext(ctx, worldId);
  assertCanReadContent(ctx.user, content, world, scope);
}

/** Assert edit access using an existing AccessContext (portal convenience). */
export function assertCanEditContentWithContext(
  ctx: AccessContext,
  content: ContentAuthTarget,
  worldId: string,
): void {
  const { world, ...scope } = scopeFromAccessContext(ctx, worldId);
  assertCanEditContent(ctx.user, content, world, scope);
}

/** Assert world read access using an existing AccessContext. */
export function assertCanReadWorldWithContext(ctx: AccessContext, worldId: string): void {
  const { world, ...scope } = scopeFromAccessContext(ctx, worldId);
  assertCanReadWorld(ctx.user, world, scope);
}
