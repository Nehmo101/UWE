import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAccessContext,
  canViewWorldContent,
  filterBlocksForViewer,
  filterPagesForViewer,
  isCoDm,
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
});

const coDmCtx = buildAccessContext({
  user: { id: "c1", displayName: "Co", email: "co@test", role: "player" },
  worldMembership: { userId: "c1", worldId: "w1", role: "co_dm", characterName: null },
  guestModeEnabled: true,
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
  it("lets everyone assigned to the world see its content", () => {
    // The only content rule left: world assignment. No dm_only, no
    // player_visible, no draft state, no per-page grant.
    assert.ok(canViewWorldContent(dmCtx));
    assert.ok(canViewWorldContent(playerCtx));
    assert.ok(canViewWorldContent(coDmCtx));
  });

  it("gives anonymous guests nothing", () => {
    assert.equal(canViewWorldContent(guestCtx), false);
    assert.equal(canViewWorldContent(guestDisabledCtx), false);
  });

  it("separates staff from players without touching content access", () => {
    assert.ok(isDmOrOwner(dmCtx));
    assert.ok(isWorldStaff(dmCtx));
    assert.ok(isWorldStaff(coDmCtx));
    assert.ok(isCoDm(coDmCtx));
    assert.equal(isDmOrOwner(playerCtx), false);
    assert.equal(isWorldStaff(playerCtx), false);
  });

  it("passes lists straight through for assigned viewers", () => {
    const pages = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.deepEqual(filterPagesForViewer(playerCtx, pages), pages);
    assert.deepEqual(filterPagesForViewer(dmCtx, pages), pages);

    const blocks = [{ type: "rich_text" }, { type: "player_text" }];
    assert.deepEqual(filterBlocksForViewer(playerCtx, blocks), blocks);
  });

  it("returns nothing for guests", () => {
    assert.deepEqual(filterPagesForViewer(guestCtx, [{ id: "a" }]), []);
    assert.deepEqual(filterBlocksForViewer(guestCtx, [{ type: "rich_text" }]), []);
  });

  it("treats preview-as-player as a player, not as staff", () => {
    const previewCtx = buildAccessContext({
      user: { id: "dm-1", displayName: "DM", email: "dm@test", role: "dm" },
      worldMembership: { userId: "dm-1", worldId: "w1", role: "owner", characterName: null },
      guestModeEnabled: true,
      preview: { previewAsUserId: "p1" },
    });

    assert.equal(previewCtx.effectiveRole, "player");
    assert.equal(isWorldStaff(previewCtx), false);
    assert.equal(isDmOrOwner(previewCtx), false);
    assert.ok(canViewWorldContent(previewCtx));
  });
});

describe("resolveEffectiveRole", () => {
  it("keeps the global owner an owner in every world", () => {
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

  it("downgrades even the global owner in preview-as-player", () => {
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

  it("maps world membership roles", () => {
    const user = { id: "u", displayName: "U", email: null, role: "player" } as const;
    assert.equal(
      resolveEffectiveRole({
        user,
        worldMembership: { userId: "u", worldId: "w1", role: "dm", characterName: null },
      }),
      "dm",
    );
    assert.equal(
      resolveEffectiveRole({
        user,
        worldMembership: { userId: "u", worldId: "w1", role: "co_dm", characterName: null },
      }),
      "readonly",
    );
    assert.equal(
      resolveEffectiveRole({
        user,
        worldMembership: { userId: "u", worldId: "w1", role: "player", characterName: null },
      }),
      "player",
    );
  });

  it("falls back to guest without user and membership", () => {
    assert.equal(resolveEffectiveRole({ user: null, worldMembership: null }), "guest");
  });
});
