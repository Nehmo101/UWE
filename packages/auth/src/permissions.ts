import type {
  AccessContext,
  AuthUser,
  ContentBlockAccessInfo,
  PageAccessInfo,
  PreviewOptions,
  UweRole,
  WorldMemberRole,
  WorldMembership,
} from "./types";

const DM_ROLES: ReadonlySet<UweRole> = new Set(["owner", "dm"]);
const WORLD_DM_ROLES: ReadonlySet<WorldMemberRole> = new Set(["owner", "dm"]);

export function isDmOrOwner(ctx: AccessContext): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }
  return DM_ROLES.has(ctx.effectiveRole);
}

export function canEditContent(ctx: AccessContext): boolean {
  return isDmOrOwner(ctx);
}

export function canPublishContent(ctx: AccessContext): boolean {
  return isDmOrOwner(ctx);
}

export function canChangeVisibility(ctx: AccessContext): boolean {
  return isDmOrOwner(ctx);
}

export function resolveEffectiveRole(input: {
  user: AuthUser | null;
  worldMembership: WorldMembership | null;
  previewAsUserId?: string | null;
}): UweRole {
  if (
    input.previewAsUserId &&
    input.worldMembership &&
    WORLD_DM_ROLES.has(input.worldMembership.role)
  ) {
    return "player";
  }

  if (input.worldMembership) {
    if (input.worldMembership.role === "owner") return "owner";
    if (input.worldMembership.role === "dm") return "dm";
    return "player";
  }

  if (input.user?.role === "owner" || input.user?.role === "dm") {
    return input.user.role;
  }

  if (input.user?.role === "player") {
    return "player";
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
  if (page.visibility === "archived") {
    return isDmOrOwner(ctx);
  }

  if (!isPublished(page)) {
    return isDmOrOwner(ctx);
  }

  if (isDmOrOwner(ctx)) {
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

  if (isDmOrOwner(ctx)) {
    return true;
  }

  if (block.visibility === "archived" || block.visibility === "dm_only") {
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

export function canPreviewAsPlayer(ctx: AccessContext): boolean {
  return (
    !ctx.previewAsUserId &&
    ctx.worldMembership !== null &&
    WORLD_DM_ROLES.has(ctx.worldMembership.role)
  );
}
