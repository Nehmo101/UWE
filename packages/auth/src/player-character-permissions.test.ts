import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAccessContext } from "./permissions";
import { canEditPlayerCharacterBlock } from "./player-character-permissions";
import type { AuthUser } from "./types";

const playerUser: AuthUser = {
  id: "player-1",
  displayName: "Player",
  email: "player@test.local",
  role: "player",
};

function playerCtx(pageIds: string[] = ["pc-1"]) {
  return buildAccessContext({
    user: playerUser,
    worldMembership: {
      id: "m-1",
      userId: playerUser.id,
      worldId: "w-1",
      role: "player",
      characterName: "Hero",
    },
    guestModeEnabled: false,
    specificPlayerPageIds: pageIds,
  });
}

describe("player character permissions", () => {
  it("allows editing player_visible blocks on assigned player_character pages", () => {
    const page = {
      id: "pc-1",
      visibility: "specific_players" as const,
      publishStatus: "published" as const,
      secretLevel: "none" as const,
      revealState: "hidden" as const,
      type: "player_character",
    };
    const block = {
      id: "b-1",
      visibility: "player_visible" as const,
      secretLevel: "none" as const,
      revealState: "hidden" as const,
      type: "player_text",
    };

    assert.equal(canEditPlayerCharacterBlock(playerCtx(), page, block), true);
  });

  it("denies editing dm_only blocks and non-character pages", () => {
    const page = {
      id: "pc-1",
      visibility: "specific_players" as const,
      publishStatus: "published" as const,
      secretLevel: "none" as const,
      revealState: "hidden" as const,
      type: "player_character",
    };
    const dmBlock = {
      id: "b-2",
      visibility: "dm_only" as const,
      secretLevel: "none" as const,
      revealState: "hidden" as const,
      type: "player_text",
    };
    const npcPage = {
      id: "npc-1",
      visibility: "player_visible" as const,
      publishStatus: "published" as const,
      secretLevel: "none" as const,
      revealState: "hidden" as const,
      type: "npc",
    };

    assert.equal(canEditPlayerCharacterBlock(playerCtx(), page, dmBlock), false);
    assert.equal(canEditPlayerCharacterBlock(playerCtx(), npcPage, dmBlock), false);
  });

  it("denies editing without specific_players access", () => {
    const page = {
      id: "pc-2",
      visibility: "specific_players" as const,
      publishStatus: "published" as const,
      secretLevel: "none" as const,
      revealState: "hidden" as const,
      type: "player_character",
    };
    const block = {
      id: "b-1",
      visibility: "player_visible" as const,
      secretLevel: "none" as const,
      revealState: "hidden" as const,
      type: "player_text",
    };

    assert.equal(canEditPlayerCharacterBlock(playerCtx(["pc-1"]), page, block), false);
  });
});
