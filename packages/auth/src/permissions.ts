import type {
  AccessContext,
  AssetAccessInfo,
  AuthUser,
  ContentBlockAccessInfo,
  PageAccessInfo,
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

export function canPublishContent(ctx: AccessContext): boolean {
  if (isCoDm(ctx)) {
    return false;
  }
  return isDmOrOwner(ctx);
}

export function canChangeVisibility(ctx: AccessContext): boolean {
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
  unlockedPageIds?: Iterable<string>;
  specificPlayerPageIds?: Iterable<string>;
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
    unlockedPageIds: new Set(input.unlockedPageIds ?? []),
    specificPlayerPageIds: new Set(input.specificPlayerPageIds ?? []),
  };
}

function isPublished(page: PageAccessInfo): boolean {
  return page.publishStatus === "published";
}

function canViewSpecificPlayerPage(ctx: AccessContext, pageId: string): boolean {
  return ctx.specificPlayerPageIds.has(pageId);
}

function canViewUnlockedPage(ctx: AccessContext, pageId: string): boolean {
  return ctx.unlockedPageIds.has(pageId);
}

export function canViewPage(ctx: AccessContext, page: PageAccessInfo): boolean {
  if (page.visibility === "archived" || page.visibility === "private") {
    return isWorldStaff(ctx);
  }

  if (!isPublished(page)) {
    return isWorldStaff(ctx);
  }

  if (isWorldStaff(ctx)) {
    return true;
  }

  switch (page.visibility) {
    case "dm_only":
      return false;
    case "player_visible":
      return ctx.effectiveRole === "player";
    case "public":
      if (ctx.effectiveRole === "player") return true;
      return ctx.effectiveRole === "guest" && ctx.guestModeEnabled;
    case "specific_players":
      return ctx.effectiveRole === "player" && canViewSpecificPlayerPage(ctx, page.id);
    case "unlock_after_session":
      return ctx.effectiveRole === "player" && canViewUnlockedPage(ctx, page.id);
    default:
      return false;
  }
}

export function canViewContentBlock(
  ctx: AccessContext,
  block: ContentBlockAccessInfo,
  page: PageAccessInfo,
): boolean {
  if (!canViewPage(ctx, page)) {
    return false;
  }

  if (isWorldStaff(ctx)) {
    return true;
  }

  if (block.type === "gm_note") {
    return false;
  }

  if (block.visibility === "archived" || block.visibility === "private" || block.visibility === "dm_only") {
    return false;
  }

  if (block.visibility === "player_visible") {
    return ctx.effectiveRole === "player";
  }

  if (block.visibility === "public") {
    if (ctx.effectiveRole === "player") return true;
    return ctx.effectiveRole === "guest" && ctx.guestModeEnabled;
  }

  if (block.visibility === "specific_players") {
    return ctx.effectiveRole === "player" && canViewSpecificPlayerPage(ctx, page.id);
  }

  if (block.visibility === "unlock_after_session") {
    return ctx.effectiveRole === "player" && canViewUnlockedPage(ctx, page.id);
  }

  return false;
}

export function filterPagesForViewer<T extends PageAccessInfo>(
  ctx: AccessContext,
  pages: T[],
): T[] {
  return pages.filter((page) => canViewPage(ctx, page));
}

export function filterBlocksForViewer<T extends ContentBlockAccessInfo>(
  ctx: AccessContext,
  blocks: T[],
  page: PageAccessInfo,
): T[] {
  return blocks.filter((block) => canViewContentBlock(ctx, block, page));
}

export function canViewAsset(ctx: AccessContext, asset: AssetAccessInfo): boolean {
  if (asset.visibility === "archived" || asset.visibility === "private") {
    return isWorldStaff(ctx);
  }

  if (isWorldStaff(ctx)) {
    return true;
  }

  switch (asset.visibility) {
    case "dm_only":
      return false;
    case "player_visible":
      return ctx.effectiveRole === "player";
    case "public":
      if (ctx.effectiveRole === "player") return true;
      return ctx.effectiveRole === "guest" && ctx.guestModeEnabled;
    case "specific_players":
      return (
        ctx.effectiveRole === "player" &&
        (asset.linkedPageIds ?? []).some((pageId) => canViewSpecificPlayerPage(ctx, pageId))
      );
    case "unlock_after_session":
      return (
        ctx.effectiveRole === "player" &&
        (asset.linkedPageIds ?? []).some((pageId) => canViewUnlockedPage(ctx, pageId))
      );
    default:
      return false;
  }
}

export function filterAssetsForViewer<T extends AssetAccessInfo>(
  ctx: AccessContext,
  assets: T[],
): T[] {
  return assets.filter((asset) => canViewAsset(ctx, asset));
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
