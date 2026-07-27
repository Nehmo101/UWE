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

function playerCtx() {
  return buildAccessContext({
    user: playerUser,
    worldMembership: {
      userId: playerUser.id,
      worldId: "w-1",
      role: "player",
      characterName: "Hero",
    },
    guestModeEnabled: false,
  });
}

const characterPage = { id: "pc-1", type: "player_character" };

describe("player character permissions", () => {
  it("allows editing text blocks on player_character pages", () => {
    assert.equal(
      canEditPlayerCharacterBlock(playerCtx(), characterPage, { type: "player_text" }),
      true,
    );
    assert.equal(
      canEditPlayerCharacterBlock(playerCtx(), characterPage, { type: "rich_text" }),
      true,
    );
  });

  it("denies non-text blocks and non-character pages", () => {
    assert.equal(
      canEditPlayerCharacterBlock(playerCtx(), characterPage, { type: "statblock" }),
      false,
    );
    assert.equal(
      canEditPlayerCharacterBlock(playerCtx(), { id: "npc-1", type: "npc" }, { type: "rich_text" }),
      false,
    );
  });

  it("denies guests and preview-as-player", () => {
    const guest = buildAccessContext({
      user: null,
      worldMembership: null,
      guestModeEnabled: true,
    });
    assert.equal(
      canEditPlayerCharacterBlock(guest, characterPage, { type: "rich_text" }),
      false,
    );

    const preview = buildAccessContext({
      user: { id: "dm-1", displayName: "DM", email: null, role: "dm" },
      worldMembership: { userId: "dm-1", worldId: "w-1", role: "dm", characterName: null },
      guestModeEnabled: false,
      preview: { previewAsUserId: playerUser.id },
    });
    assert.equal(
      canEditPlayerCharacterBlock(preview, characterPage, { type: "rich_text" }),
      false,
    );
  });
});
