import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateAdminGate, requireAdminRole, requirePlayerBlocked } from "./admin-gate";

describe("admin-gate", () => {
  it("blocks players from admin APIs", () => {
    const denied = requirePlayerBlocked({
      id: "p1",
      displayName: "Player",
      email: null,
      role: "player",
    });
    assert.equal(denied?.status, 403);
  });

  it("requires admin role for session auth", () => {
    const denied = requireAdminRole({
      id: "d1",
      displayName: "DM",
      email: null,
      role: "dm",
    });
    assert.equal(denied?.status, 403);
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
