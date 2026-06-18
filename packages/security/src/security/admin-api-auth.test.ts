import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateAdminGate } from "@uwe/auth";
import { requireAdminApiAuth, type ApiAuthContext } from "@uwe/security";

function mockRequest(): Request {
  return new Request("https://studio.example/api/admin/status", {
    headers: { origin: "https://studio.example" },
  });
}

describe("admin api auth", () => {
  it("blocks player session on admin routes", () => {
    const context: ApiAuthContext = {
      user: { id: "1", displayName: "P", email: null, role: "player" },
      apiTokenId: null,
      apiTokenScopes: null,
      authMethod: "session",
    };
    const denied = requireAdminApiAuth(mockRequest(), context, { requiredScopes: ["admin_read"] });
    assert.ok(denied);
    assert.equal(denied?.status, 403);
  });

  it("allows admin session", () => {
    const context: ApiAuthContext = {
      user: { id: "1", displayName: "A", email: null, role: "admin" },
      apiTokenId: null,
      apiTokenScopes: null,
      authMethod: "session",
    };
    const denied = requireAdminApiAuth(mockRequest(), context, { requiredScopes: ["admin_read"] });
    assert.equal(denied, null);
  });

  it("allows scoped api token without admin role user object", () => {
    const gate = evaluateAdminGate({
      user: null,
      apiTokenScopes: ["admin_read"],
      requiredScopes: ["admin_read"],
    });
    assert.equal(gate, null);
  });
});
