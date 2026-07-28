import type { AccessContext } from "./types";

const EDITABLE_BLOCK_TYPES = new Set(["player_text", "rich_text"]);

/**
 * Players may edit the text blocks of their own character sheet. The DM keeps
 * canon control — players cannot change page metadata, only block content.
 *
 * „Player" is now simply: assigned to this world through the Portal, and not
 * holding the Studio checkbox (a DM edits through Studio, not through here).
 */
export function canEditPlayerCharacterBlock(
  ctx: AccessContext,
  page: { id: string; type: string },
  block: { type: string },
): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }

  if (!ctx.user || ctx.worldMembership === null) {
    return false;
  }

  if (ctx.user.access.studio) {
    return false;
  }

  if (page.type !== "player_character") {
    return false;
  }

  return EDITABLE_BLOCK_TYPES.has(block.type);
}
