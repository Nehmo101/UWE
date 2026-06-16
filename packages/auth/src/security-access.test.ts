import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessSecurityDashboard } from "./security-access";

describe("security dashboard access", () => {
  it("allows OWNER and ADMIN", () => {
    assert.equal(canAccessSecurityDashboard("owner"), true);
    assert.equal(canAccessSecurityDashboard("admin"), true);
  });

  it("blocks DM and PLAYER", () => {
    assert.equal(canAccessSecurityDashboard("dm"), false);
    assert.equal(canAccessSecurityDashboard("player"), false);
    assert.equal(canAccessSecurityDashboard("guest"), false);
  });
});
