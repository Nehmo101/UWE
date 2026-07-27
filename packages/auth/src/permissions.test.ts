import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAccessContext,
  canEditContent,
  canPreviewAsPlayer,
  canViewWorldContent,
  filterBlocksForViewer,
  filterPagesForViewer,
  isDm,
  isOwner,
} from "./permissions";
import type { AreaAccess, AuthUser } from "./types";

function access(partial: Partial<AreaAccess> = {}): AreaAccess {
  return { portal: false, studio: false, brain: false, family: false, ...partial };
}

function user(id: string, overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id,
    displayName: id,
    email: `${id}@test`,
    isOwner: false,
    access: access(),
    ...overrides,
  };
}

const ownerCtx = buildAccessContext({
  user: user("owner-1", { isOwner: true, access: access({ portal: true, studio: true, brain: true, family: true }) }),
  worldMembership: { userId: "owner-1", worldId: "w1", characterName: null },
});

const dmCtx = buildAccessContext({
  user: user("dm-1", { access: access({ portal: true, studio: true }) }),
  worldMembership: { userId: "dm-1", worldId: "w1", characterName: null },
});

const playerCtx = buildAccessContext({
  user: user("p1", { access: access({ portal: true }) }),
  worldMembership: { userId: "p1", worldId: "w1", characterName: "Aman" },
});

/** Portal checkbox, but not assigned to this world. */
const outsiderCtx = buildAccessContext({
  user: user("out-1", { access: access({ portal: true }) }),
  worldMembership: null,
});

const anonymousCtx = buildAccessContext({ user: null, worldMembership: null });

describe("permissions", () => {
  it("lets everyone assigned to the world see its content", () => {
    // The only content rule left: world assignment. No dm_only, no
    // player_visible, no draft state, no per-page grant.
    assert.ok(canViewWorldContent(ownerCtx));
    assert.ok(canViewWorldContent(dmCtx));
    assert.ok(canViewWorldContent(playerCtx));
  });

  it("gives an unassigned Portal user and an anonymous visitor nothing", () => {
    assert.equal(canViewWorldContent(outsiderCtx), false);
    assert.equal(canViewWorldContent(anonymousCtx), false);
  });

  it("lets the Studio checkbox reach a world without an assignment", () => {
    const studioOutsider = buildAccessContext({
      user: user("dm-2", { access: access({ studio: true }) }),
      worldMembership: null,
    });
    assert.ok(canViewWorldContent(studioOutsider));
  });

  it("makes editing the Studio checkbox, nothing else", () => {
    assert.ok(canEditContent(dmCtx));
    assert.ok(canEditContent(ownerCtx));
    assert.equal(canEditContent(playerCtx), false);
    assert.equal(canEditContent(anonymousCtx), false);
  });

  it("separates the owner from other Studio users", () => {
    assert.ok(isOwner(ownerCtx));
    assert.equal(isOwner(dmCtx), false);
    assert.ok(isDm(ownerCtx));
    assert.ok(isDm(dmCtx));
    assert.equal(isDm(playerCtx), false);
  });

  it("drops Studio rights while previewing as a player", () => {
    const preview = buildAccessContext({
      user: user("dm-1", { access: access({ portal: true, studio: true }) }),
      worldMembership: { userId: "dm-1", worldId: "w1", characterName: null },
      preview: { previewAsUserId: "p1" },
    });
    assert.equal(isDm(preview), false);
    assert.equal(canEditContent(preview), false);
    assert.equal(canPreviewAsPlayer(preview), false);
    // Content stays readable — the preview still belongs to the world.
    assert.ok(canViewWorldContent(preview));
  });

  it("only offers player preview to Studio users", () => {
    assert.ok(canPreviewAsPlayer(dmCtx));
    assert.equal(canPreviewAsPlayer(playerCtx), false);
  });

  it("filters lists by the same single rule", () => {
    const pages = [{ id: "a" }, { id: "b" }];
    assert.deepEqual(filterPagesForViewer(playerCtx, pages), pages);
    assert.deepEqual(filterPagesForViewer(outsiderCtx, pages), []);
    assert.deepEqual(filterBlocksForViewer(dmCtx, pages), pages);
    assert.deepEqual(filterBlocksForViewer(anonymousCtx, pages), []);
  });
});
