import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAccessContext } from "./permissions";
import { canEditPlayerCharacterBlock } from "./player-character-permissions";
import { NO_AREA_ACCESS, type AuthUser } from "./types";

const playerUser: AuthUser = {
  id: "player-1",
  displayName: "Player",
  email: "player@test.local",
  isOwner: false,
  access: { ...NO_AREA_ACCESS, portal: true },
};

function playerCtx() {
  return buildAccessContext({
    user: playerUser,
    worldMembership: {
      userId: playerUser.id,
      worldId: "w-1",
      characterName: "Hero",
    },
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

  it("denies anonymous visitors and preview-as-player", () => {
    const anonymous = buildAccessContext({ user: null, worldMembership: null });
    assert.equal(
      canEditPlayerCharacterBlock(anonymous, characterPage, { type: "rich_text" }),
      false,
    );

    const preview = buildAccessContext({
      user: {
        id: "dm-1",
        displayName: "DM",
        email: null,
        isOwner: false,
        access: { ...NO_AREA_ACCESS, portal: true, studio: true },
      },
      worldMembership: { userId: "dm-1", worldId: "w-1", characterName: null },
      preview: { previewAsUserId: playerUser.id },
    });
    assert.equal(
      canEditPlayerCharacterBlock(preview, characterPage, { type: "rich_text" }),
      false,
    );
  });

  it("denies a DM — canon is edited in Studio, not through the sheet", () => {
    const dm = buildAccessContext({
      user: {
        id: "dm-2",
        displayName: "DM",
        email: null,
        isOwner: false,
        access: { ...NO_AREA_ACCESS, portal: true, studio: true },
      },
      worldMembership: { userId: "dm-2", worldId: "w-1", characterName: null },
    });
    assert.equal(canEditPlayerCharacterBlock(dm, characterPage, { type: "rich_text" }), false);
  });
});
