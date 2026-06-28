import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_ACCESS_ROLES } from "@uwe/auth";
import { requireOwnerApiAuth } from "@uwe/security";

function makeRequest(path: string, headers: Record<string, string> = {}) {
  return new Request(`https://studio.local${path}`, { method: "POST", headers });
}

describe("owner setup API guards", () => {
  it("blocks admin session from owner-only setup tests", () => {
    const result = requireOwnerApiAuth(
      makeRequest("/api/admin/setup/test/mail"),
      {
        user: { id: "1", role: "admin", displayName: "Admin", email: "admin@test" },
        apiTokenId: null,
        apiTokenScopes: null,
        authMethod: "session",
      },
      { rateLimit: "setup" },
    );
    assert.ok(result);
    assert.equal(result.status, 403);
  });

  it("allows owner session for setup tests", () => {
    const result = requireOwnerApiAuth(
      makeRequest("/api/admin/setup/test/urls"),
      {
        user: { id: "1", role: "owner", displayName: "Owner", email: "owner@test" },
        apiTokenId: null,
        apiTokenScopes: null,
        authMethod: "session",
      },
      { rateLimit: "setup" },
    );
    assert.equal(result, null);
  });

  it("admin routes remain admin-accessible", () => {
    assert.ok(ADMIN_ACCESS_ROLES.includes("admin"));
    assert.ok(ADMIN_ACCESS_ROLES.includes("owner"));
    assert.equal(ADMIN_ACCESS_ROLES.length, 2);
  });
});
