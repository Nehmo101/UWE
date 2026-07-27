import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRequiredAccessForApiPath } from "@uwe/auth";
import { requireOwnerApiAuth } from "@uwe/security";

function makeRequest(path: string, headers: Record<string, string> = {}) {
  return new Request(`https://studio.local${path}`, { method: "POST", headers });
}

const studioUser = {
  id: "1",
  displayName: "DM",
  email: "dm@test",
  isOwner: false,
  access: { portal: true, studio: true, brain: false, family: false },
};

const ownerUser = {
  id: "2",
  displayName: "Owner",
  email: "owner@test",
  isOwner: true,
  access: { portal: true, studio: true, brain: true, family: true },
};

describe("owner setup API guards", () => {
  it("blocks a Studio session from owner-only setup tests", () => {
    const result = requireOwnerApiAuth(
      makeRequest("/api/admin/setup/test/mail"),
      {
        user: studioUser,
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
        user: ownerUser,
        apiTokenId: null,
        apiTokenScopes: null,
        authMethod: "session",
      },
      { rateLimit: "setup" },
    );
    assert.equal(result, null);
  });

  it("keeps /api/admin owner-only at the route gate", () => {
    // The `admin` role tier is gone: /api/admin now needs the owner flag, and
    // everything else in Studio needs the Studio checkbox.
    assert.equal(getRequiredAccessForApiPath("/api/admin/setup/test/mail"), "owner");
    assert.equal(getRequiredAccessForApiPath("/api/worlds"), "studio");
  });
});
