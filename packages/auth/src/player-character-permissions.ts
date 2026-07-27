import type { AccessContext } from "./types";
import { canViewWorldContent } from "./permissions";

const EDITABLE_BLOCK_TYPES = new Set(["player_text", "rich_text"]);

/**
 * Players may edit the text blocks of their own character sheet. The DM keeps
 * canon control — players cannot change page metadata, only block content.
 */
export function canEditPlayerCharacterBlock(
  ctx: AccessContext,
  page: { id: string; type: string },
  block: { type: string },
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

  if (!canViewWorldContent(ctx)) {
    return false;
  }

  return EDITABLE_BLOCK_TYPES.has(block.type);
}
