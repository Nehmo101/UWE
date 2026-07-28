import type {
  AccessContext,
  AuthUser,
  PreviewOptions,
  WorldMembership,
} from "./types";

/**
 * Studio is the DM workspace, so the Studio checkbox is what makes someone a
 * DM. Preview mode deliberately drops it: that is the point of previewing.
 */
export function isDm(ctx: AccessContext): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }
  return ctx.user?.access.studio === true;
}

export function isOwner(ctx: AccessContext): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }
  return ctx.user?.isOwner === true;
}

export function canEditContent(ctx: AccessContext): boolean {
  return isDm(ctx);
}

export function buildAccessContext(input: {
  user: AuthUser | null;
  worldMembership: WorldMembership | null;
  preview?: PreviewOptions;
}): AccessContext {
  return {
    user: input.user,
    worldMembership: input.worldMembership,
    previewAsUserId: input.preview?.previewAsUserId ?? null,
  };
}

/**
 * The single content rule inside a world: whoever is assigned to the world
 * sees everything in it.
 *
 * Per-item visibility is gone (Notiz Lasse, 2026-07-26) — there is no
 * `dm_only`, no `player_visible`, no draft state and no per-page grant left to
 * differentiate. What remains is the assignment itself, plus the Studio
 * checkbox, which reaches every world by design.
 */
export function canViewWorldContent(ctx: AccessContext): boolean {
  if (ctx.worldMembership !== null) {
    return true;
  }
  return ctx.user?.access.studio === true;
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

/** Only a Studio user can look at their world through a player's eyes. */
export function canPreviewAsPlayer(ctx: AccessContext): boolean {
  return !ctx.previewAsUserId && ctx.user?.access.studio === true;
}

/** The security audit log is a Studio concern. */
export function canViewAuditLog(ctx: AccessContext): boolean {
  return isDm(ctx);
}
