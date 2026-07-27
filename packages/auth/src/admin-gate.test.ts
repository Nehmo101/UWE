import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateAdminGate, requireOwnerAccess, requireStudioAccess } from "./admin-gate";
import { NO_AREA_ACCESS, type AuthUser } from "./types";

function user(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: "u1",
    displayName: "Test",
    email: null,
    isOwner: false,
    access: { ...NO_AREA_ACCESS },
    ...overrides,
  };
}

describe("admin-gate", () => {
  it("blocks a Portal-only user from Studio APIs", () => {
    const denied = requireStudioAccess(
      user({ id: "p1", access: { ...NO_AREA_ACCESS, portal: true } }),
    );
    assert.equal(denied?.status, 403);
  });

  it("lets the Studio checkbox through the Studio gate", () => {
    const allowed = requireStudioAccess(
      user({ id: "d1", access: { ...NO_AREA_ACCESS, studio: true } }),
    );
    assert.equal(allowed, null);
  });

  it("requires the owner for admin APIs — Studio access is not enough", () => {
    const denied = requireOwnerAccess(
      user({ id: "d1", access: { ...NO_AREA_ACCESS, studio: true } }),
    );
    assert.equal(denied?.status, 403);
    assert.equal(requireOwnerAccess(user({ id: "o1", isOwner: true })), null);
  });

  it("demands a session before anything else", () => {
    assert.equal(requireOwnerAccess(null)?.status, 401);
    assert.equal(requireStudioAccess(null)?.status, 401);
  });

  it("allows scoped api tokens without session user", () => {
    const result = evaluateAdminGate({
      user: null,
      apiTokenScopes: ["admin_read"],
      requiredScopes: ["admin_read"],
    });
    assert.equal(result, null);
  });

  it("denies api token without required scope", () => {
    const result = evaluateAdminGate({
      user: null,
      apiTokenScopes: ["health_read"],
      requiredScopes: ["admin_read"],
    });
    assert.equal(result?.status, 403);
  });
});
