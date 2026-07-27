import type {
  AccessContext,
  AuthUser,
  PreviewOptions,
  UweRole,
  WorldMemberRole,
  WorldMembership,
} from "./types";

const DM_ROLES: ReadonlySet<UweRole> = new Set(["owner", "admin", "dm"]);
const WORLD_DM_ROLES: ReadonlySet<WorldMemberRole> = new Set(["owner", "dm"]);
const WORLD_CO_DM_ROLES: ReadonlySet<WorldMemberRole> = new Set(["co_dm"]);

export function isCoDm(ctx: AccessContext): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }
  return (
    ctx.worldMembership !== null &&
    WORLD_CO_DM_ROLES.has(ctx.worldMembership.role)
  );
}

/** DM, owner, or co-DM — read access to world staff content. */
export function isWorldStaff(ctx: AccessContext): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }
  return isDmOrOwner(ctx) || isCoDm(ctx);
}

export function isDmOrOwner(ctx: AccessContext): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }
  return DM_ROLES.has(ctx.effectiveRole);
}

export function canEditContent(ctx: AccessContext): boolean {
  if (isCoDm(ctx)) {
    return false;
  }
  return isDmOrOwner(ctx);
}

export function resolveEffectiveRole(input: {
  user: AuthUser | null;
  worldMembership: WorldMembership | null;
  previewAsUserId?: string | null;
}): UweRole {
  if (input.previewAsUserId) {
    const canPreviewAsPlayer =
      input.user?.role === "owner" ||
      input.user?.role === "admin" ||
      input.user?.role === "dm" ||
      (input.worldMembership !== null && WORLD_DM_ROLES.has(input.worldMembership.role));
    if (canPreviewAsPlayer) {
      return "player";
    }
  }

  // Global system owner keeps full owner privileges in every world context,
  // even when they also hold a player world membership for playtesting.
  if (input.user?.role === "owner") {
    return "owner";
  }

  if (input.worldMembership) {
    if (input.worldMembership.role === "owner") return "owner";
    if (input.worldMembership.role === "dm") return "dm";
    if (input.worldMembership.role === "co_dm") return "readonly";
    return "player";
  }

  if (input.user?.role === "admin" || input.user?.role === "dm") {
    return input.user.role === "admin" ? "dm" : input.user.role;
  }

  if (input.user?.role === "player" || input.user?.role === "readonly") {
    return input.user.role;
  }

  return "guest";
}

export function buildAccessContext(input: {
  user: AuthUser | null;
  worldMembership: WorldMembership | null;
  guestModeEnabled: boolean;
  preview?: PreviewOptions;
}): AccessContext {
  const previewAsUserId = input.preview?.previewAsUserId ?? null;

  return {
    user: input.user,
    worldMembership: input.worldMembership,
    effectiveRole: resolveEffectiveRole({
      user: input.user,
      worldMembership: input.worldMembership,
      previewAsUserId,
    }),
    guestModeEnabled: input.guestModeEnabled,
    previewAsUserId,
  };
}

/**
 * The single content rule inside a world: whoever is assigned to the world
 * sees everything in it.
 *
 * Per-item visibility is gone (Notiz Lasse, 2026-07-26) — there is no
 * `dm_only`, no `player_visible`, no draft state and no per-page grant left to
 * differentiate. What remains is the world boundary itself, which the caller
 * has already crossed by holding an access context for this world. Anonymous
 * guests are the one exception: they are not assigned to anything.
 */
export function canViewWorldContent(ctx: AccessContext): boolean {
  return ctx.effectiveRole !== "guest";
}

export function filterPagesForViewer<T>(ctx: AccessContext, pages: T[]): T[] {
  return canViewWorldContent(ctx) ? pages : [];
}

export function filterBlocksForViewer<T>(ctx: AccessContext, blocks: T[]): T[] {
  return canViewWorldContent(ctx) ? blocks : [];
}

export function filterAssetsForViewer<T>(ctx: AccessContext, assets: T[]): T[] {
  return canViewWorldContent(ctx) ? assets : [];
}

export function canPreviewAsPlayer(ctx: AccessContext): boolean {
  return (
    !ctx.previewAsUserId &&
    ctx.worldMembership !== null &&
    WORLD_DM_ROLES.has(ctx.worldMembership.role)
  );
}

/** Only OWNER/DM roles may view the security audit log. */
export function canViewAuditLog(ctx: AccessContext): boolean {
  return isDmOrOwner(ctx);
}
