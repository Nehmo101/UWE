import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAccessContext,
  canViewContentBlock,
  canViewPage,
  filterBlocksForViewer,
  filterPagesForViewer,
  isDmOrOwner,
  isWorldStaff,
  resolveEffectiveRole,
} from "./permissions";

const dmCtx = buildAccessContext({
  user: { id: "dm-1", displayName: "DM", email: "dm@test", role: "dm" },
  worldMembership: { userId: "dm-1", worldId: "w1", role: "owner", characterName: null },
  guestModeEnabled: true,
});

const playerCtx = buildAccessContext({
  user: { id: "p1", displayName: "Aman", email: "aman@test", role: "player" },
  worldMembership: { userId: "p1", worldId: "w1", role: "player", characterName: "Aman" },
  guestModeEnabled: true,
  specificPlayerPageIds: ["page-secret"],
  unlockedPageIds: ["page-unlocked"],
});

const guestCtx = buildAccessContext({
  user: null,
  worldMembership: null,
  guestModeEnabled: true,
});

const guestDisabledCtx = buildAccessContext({
  user: null,
  worldMembership: null,
  guestModeEnabled: false,
});

describe("permissions", () => {
  it("lets DM see everything including dm_only and archived", () => {
    assert.ok(isDmOrOwner(dmCtx));
    assert.ok(
      canViewPage(dmCtx, {
        id: "page-1",
        visibility: "dm_only",
        publishStatus: "published",
      }),
    );
    assert.ok(
      canViewPage(dmCtx, {
        id: "page-2",
        visibility: "archived",
        publishStatus: "published",
      }),
    );
  });

  it("hides gm-only content from players", () => {
    assert.ok(
      !canViewPage(playerCtx, {
        id: "page-1",
        visibility: "dm_only",
        publishStatus: "published",
      }),
    );
    assert.ok(
      !canViewContentBlock(
        playerCtx,
        { visibility: "dm_only" },
        { id: "page-1", visibility: "player_visible", publishStatus: "published" },
      ),
    );
  });

  it("shows player_visible and public content to players", () => {
    assert.ok(
      canViewPage(playerCtx, {
        id: "page-2",
        visibility: "player_visible",
        publishStatus: "published",
      }),
    );
    assert.ok(
      canViewPage(playerCtx, {
        id: "page-3",
        visibility: "public",
        publishStatus: "published",
      }),
    );
  });

  it("shows only public content to guests when guest mode is enabled", () => {
    assert.ok(
      canViewPage(guestCtx, {
        id: "page-3",
        visibility: "public",
        publishStatus: "published",
      }),
    );
    assert.ok(
      !canViewPage(guestCtx, {
        id: "page-2",
        visibility: "player_visible",
        publishStatus: "published",
      }),
    );
  });

  it("hides all portal content from guests when guest mode is disabled", () => {
    assert.ok(
      !canViewPage(guestDisabledCtx, {
        id: "page-3",
        visibility: "public",
        publishStatus: "published",
      }),
    );
  });

  it("supports specific_players visibility", () => {
    assert.ok(
      canViewPage(playerCtx, {
        id: "page-secret",
        visibility: "specific_players",
        publishStatus: "published",
      }),
    );

    const otherPlayer = buildAccessContext({
      user: { id: "p2", displayName: "Lazul", email: "lazul@test", role: "player" },
      worldMembership: { userId: "p2", worldId: "w1", role: "player", characterName: "Lazul" },
      guestModeEnabled: true,
      specificPlayerPageIds: [],
    });

    assert.ok(
      !canViewPage(otherPlayer, {
        id: "page-secret",
        visibility: "specific_players",
        publishStatus: "published",
      }),
    );
  });

  it("supports unlock_after_session visibility", () => {
    assert.ok(
      canViewPage(playerCtx, {
        id: "page-unlocked",
        visibility: "unlock_after_session",
        publishStatus: "published",
      }),
    );

    assert.ok(
      !canViewPage(playerCtx, {
        id: "page-locked",
        visibility: "unlock_after_session",
        publishStatus: "published",
      }),
    );
  });

  it("hides archived pages from players", () => {
    assert.ok(
      !canViewPage(playerCtx, {
        id: "page-archived",
        visibility: "archived",
        publishStatus: "published",
      }),
    );
  });

  it("preview-as-player restricts DM to player visibility", () => {
    const previewCtx = buildAccessContext({
      user: { id: "dm-1", displayName: "DM", email: "dm@test", role: "dm" },
      worldMembership: { userId: "dm-1", worldId: "w1", role: "owner", characterName: null },
      guestModeEnabled: true,
      preview: { previewAsUserId: "p1" },
      specificPlayerPageIds: ["page-secret"],
      unlockedPageIds: [],
    });

    assert.ok(!isDmOrOwner(previewCtx));
    assert.ok(
      !canViewPage(previewCtx, {
        id: "page-1",
        visibility: "dm_only",
        publishStatus: "published",
      }),
    );
    assert.ok(
      canViewPage(previewCtx, {
        id: "page-secret",
        visibility: "specific_players",
        publishStatus: "published",
      }),
    );
    assert.ok(
      !canViewPage(previewCtx, {
        id: "page-unlocked",
        visibility: "unlock_after_session",
        publishStatus: "published",
      }),
    );
  });

  it("global owner keeps owner role even with player world membership", () => {
    assert.equal(
      resolveEffectiveRole({
        user: { id: "owner-1", displayName: "Owner", email: "owner@test", role: "owner" },
        worldMembership: {
          userId: "owner-1",
          worldId: "w1",
          role: "player",
          characterName: "Testchar",
        },
      }),
      "owner",
    );

    const ctx = buildAccessContext({
      user: { id: "owner-1", displayName: "Owner", email: "owner@test", role: "owner" },
      worldMembership: {
        userId: "owner-1",
        worldId: "w1",
        role: "player",
        characterName: "Testchar",
      },
      guestModeEnabled: true,
    });
    assert.equal(isWorldStaff(ctx), true);
    assert.equal(isDmOrOwner(ctx), true);
  });

  it("global owner preview-as-player still downgrades to player visibility", () => {
    assert.equal(
      resolveEffectiveRole({
        user: { id: "owner-1", displayName: "Owner", email: "owner@test", role: "owner" },
        worldMembership: {
          userId: "owner-1",
          worldId: "w1",
          role: "player",
          characterName: "Testchar",
        },
        previewAsUserId: "owner-1",
      }),
      "player",
    );
  });

  it("filters page and block lists for the effective viewer", () => {
    const pages = [
      { id: "a", visibility: "public" as const, publishStatus: "published" },
      { id: "b", visibility: "dm_only" as const, publishStatus: "published" },
      { id: "c", visibility: "player_visible" as const, publishStatus: "published" },
    ];

    const visible = filterPagesForViewer(playerCtx, pages);
    assert.deepEqual(
      visible.map((page) => page.id),
      ["a", "c"],
    );

    const page = { id: "c", visibility: "player_visible" as const, publishStatus: "published" };
    const blocks = filterBlocksForViewer(
      playerCtx,
      [
        { visibility: "player_visible" as const },
        { visibility: "dm_only" as const },
      ],
      page,
    );

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]?.visibility, "player_visible");
  });
});
