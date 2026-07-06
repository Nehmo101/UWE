import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_ACCESS_ROLES,
  canAccessAdmin,
  canAccessStudio,
  getRequiredRolesForApiPath,
  getRequiredRolesForPagePath,
  hasAnyRole,
  requireOwner,
  requireRole,
  requireUser,
  STUDIO_ACCESS_ROLES,
} from "./roles";
import type { AuthUser } from "./types";

const owner: AuthUser = {
  id: "1",
  displayName: "Owner",
  email: "owner@test",
  role: "owner",
};

const admin: AuthUser = {
  id: "2",
  displayName: "Admin",
  email: "admin@test",
  role: "admin",
};

const dm: AuthUser = {
  id: "3",
  displayName: "DM",
  email: "dm@test",
  role: "dm",
};

const player: AuthUser = {
  id: "4",
  displayName: "Player",
  email: "player@test",
  role: "player",
};

describe("role guards", () => {
  it("maps API and page paths to required roles", () => {
    assert.deepEqual(getRequiredRolesForApiPath("/api/admin/status"), ADMIN_ACCESS_ROLES);
    assert.deepEqual(getRequiredRolesForApiPath("/api/brain/run"), STUDIO_ACCESS_ROLES);
    assert.deepEqual(getRequiredRolesForApiPath("/api/ai/generate"), STUDIO_ACCESS_ROLES);
    assert.deepEqual(getRequiredRolesForApiPath("/api/import/preview"), STUDIO_ACCESS_ROLES);
    assert.deepEqual(getRequiredRolesForApiPath("/api/backup"), STUDIO_ACCESS_ROLES);
    assert.equal(getRequiredRolesForApiPath("/api/health"), null);

    assert.deepEqual(getRequiredRolesForPagePath("/admin/status"), ADMIN_ACCESS_ROLES);
    assert.deepEqual(getRequiredRolesForPagePath("/worlds/demo"), STUDIO_ACCESS_ROLES);
    assert.deepEqual(getRequiredRolesForPagePath("/ideas"), ["owner"]);
  });

  it("allows studio access for owner, admin and dm", () => {
    assert.ok(canAccessStudio(owner));
    assert.ok(canAccessStudio(admin));
    assert.ok(canAccessStudio(dm));
    assert.ok(!canAccessStudio(player));
  });

  it("allows admin access only for owner and admin", () => {
    assert.ok(canAccessAdmin(owner));
    assert.ok(canAccessAdmin(admin));
    assert.ok(!canAccessAdmin(dm));
    assert.ok(!canAccessAdmin(player));
  });

  it("requireUser throws when unauthenticated", () => {
    assert.throws(() => requireUser(null), /Authentication required/);
    assert.equal(requireUser(owner).id, owner.id);
  });

  it("requireRole enforces allowed roles", () => {
    assert.equal(requireRole(dm, STUDIO_ACCESS_ROLES).role, "dm");
    assert.throws(() => requireRole(player, ADMIN_ACCESS_ROLES), /Insufficient role/);
  });

  it("requireOwner accepts only owner", () => {
    assert.equal(requireOwner(owner).role, "owner");
    assert.throws(() => requireOwner(admin), /Insufficient role/);
  });

  it("hasAnyRole checks membership", () => {
    assert.ok(hasAnyRole(admin, ADMIN_ACCESS_ROLES));
    assert.ok(!hasAnyRole(dm, ADMIN_ACCESS_ROLES));
  });
});
