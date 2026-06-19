import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuthUser } from "@uwe/auth";
import {
  canApproveReviews,
  canDirectlyEditCanon,
  canManageBackups,
  canManageSecurity,
  canManageUsers,
  hasCapability,
  mustSubmitProposal,
} from "@uwe/auth";

function user(role: AuthUser["role"]): AuthUser {
  return { id: "u1", displayName: "Test", email: null, role };
}

describe("role capabilities", () => {
  it("owner has full system and canon access", () => {
    const ctx = { user: user("owner") };
    assert.equal(hasCapability(ctx, "system_admin"), true);
    assert.equal(hasCapability(ctx, "canon_edit"), true);
    assert.equal(canDirectlyEditCanon(ctx), true);
    assert.equal(mustSubmitProposal(ctx), false);
    assert.equal(canManageSecurity(ctx), true);
  });

  it("admin manages users/backups but not canon", () => {
    const ctx = { user: user("admin") };
    assert.equal(canManageUsers(ctx), true);
    assert.equal(canManageBackups(ctx), true);
    assert.equal(hasCapability(ctx, "canon_edit"), false);
    assert.equal(canDirectlyEditCanon(ctx), false);
    assert.equal(canApproveReviews(ctx), true);
    assert.equal(canManageSecurity(ctx), false);
  });

  it("dm can edit canon directly", () => {
    const ctx = { user: user("dm") };
    assert.equal(canDirectlyEditCanon(ctx), true);
    assert.equal(canApproveReviews(ctx), true);
    assert.equal(mustSubmitProposal(ctx), false);
  });

  it("co_dm world membership must submit proposals", () => {
    const ctx = {
      user: user("player"),
      worldMembership: {
        userId: "u1",
        worldId: "w1",
        role: "co_dm" as const,
        characterName: null,
      },
    };
    assert.equal(canDirectlyEditCanon(ctx), false);
    assert.equal(mustSubmitProposal(ctx), true);
    assert.equal(hasCapability(ctx, "proposal_submit"), true);
    assert.equal(hasCapability(ctx, "world_edit"), false);
  });

  it("world dm membership grants canon edit", () => {
    const ctx = {
      user: user("player"),
      worldMembership: {
        userId: "u1",
        worldId: "w1",
        role: "dm" as const,
        characterName: null,
      },
    };
    assert.equal(canDirectlyEditCanon(ctx), true);
    assert.equal(mustSubmitProposal(ctx), false);
  });

  it("player can edit own notes only", () => {
    const ctx = { user: user("player") };
    assert.equal(hasCapability(ctx, "player_note_edit_own"), true);
    assert.equal(hasCapability(ctx, "world_edit"), false);
  });
});
