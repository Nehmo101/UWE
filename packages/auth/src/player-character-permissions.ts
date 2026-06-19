import type { AccessContext, ContentBlockAccessInfo, PageAccessInfo } from "./types";
import { canViewContentBlock, canViewPage } from "./permissions";

const EDITABLE_BLOCK_TYPES = new Set(["player_text", "rich_text"]);

/**
 * Players may edit their own character sheet blocks when the page is visible
 * to them and the block is marked player_visible. DM retains canon and
 * visibility control — players cannot change page metadata or dm_only blocks.
 */
export function canEditPlayerCharacterBlock(
  ctx: AccessContext,
  page: PageAccessInfo & { type: string },
  block: ContentBlockAccessInfo & { type: string },
): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }

  if (ctx.effectiveRole !== "player" || !ctx.user) {
    return false;
  }

  if (page.type !== "player_character") {
    return false;
  }

  if (!canViewPage(ctx, page)) {
    return false;
  }

  if (!EDITABLE_BLOCK_TYPES.has(block.type)) {
    return false;
  }

  if (block.visibility !== "player_visible") {
    return false;
  }

  if (!canViewContentBlock(ctx, block, page)) {
    return false;
  }

  const hasSpecificAccess = ctx.specificPlayerPageIds.has(page.id);
  if (page.visibility === "specific_players") {
    return hasSpecificAccess;
  }

  return page.visibility === "player_visible" || page.visibility === "public";
}
