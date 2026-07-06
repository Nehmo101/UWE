import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateAdminGate } from "@uwe/auth";
import { requireAdminApiAuth, requireStudioRoleApiAuth, type ApiAuthContext } from "@uwe/security";

function mockStudioRequest(path = "/api/backup"): Request {
  return new Request(`https://studio.example${path}`, {
    headers: { origin: "https://studio.example" },
  });
}

describe("studio role api auth", () => {
  it("blocks player session on studio API routes", () => {
    const context: ApiAuthContext = {
      user: { id: "1", displayName: "P", email: null, role: "player" },
      apiTokenId: null,
      apiTokenScopes: null,
      authMethod: "session",
    };
    const denied = requireStudioRoleApiAuth(mockStudioRequest(), context);
    assert.ok(denied);
    assert.equal(denied?.status, 403);
  });

  it("allows dm session on studio API routes", () => {
    const context: ApiAuthContext = {
      user: { id: "2", displayName: "DM", email: null, role: "dm" },
      apiTokenId: null,
      apiTokenScopes: null,
      authMethod: "session",
    };
    const denied = requireStudioRoleApiAuth(mockStudioRequest(), context);
    assert.equal(denied, null);
  });

  it("blocks dm session on admin API routes", () => {
    const context: ApiAuthContext = {
      user: { id: "2", displayName: "DM", email: null, role: "dm" },
      apiTokenId: null,
      apiTokenScopes: null,
      authMethod: "session",
    };
    const denied = requireStudioRoleApiAuth(mockStudioRequest("/api/admin/status"), context);
    assert.ok(denied);
    assert.equal(denied?.status, 403);
  });
});

describe("admin api auth", () => {
  it("blocks player session on admin routes", () => {
    const context: ApiAuthContext = {
      user: { id: "1", displayName: "P", email: null, role: "player" },
      apiTokenId: null,
      apiTokenScopes: null,
      authMethod: "session",
    };
    const denied = requireAdminApiAuth(mockStudioRequest("/api/admin/status"), context, { requiredScopes: ["admin_read"] });
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
    const denied = requireAdminApiAuth(mockStudioRequest("/api/admin/status"), context, { requiredScopes: ["admin_read"] });
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
