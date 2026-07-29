import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { requireRestoreOwnerAuth, type ApiAuthContext } from "@uwe/security";

function mockRestoreRequest(headers: Record<string, string> = {}): Request {
  // "sec-fetch-site: same-origin" (and no cross-site Origin) keeps the CSRF
  // guard satisfied so the test exercises the owner-role logic, not CSRF.
  return new Request("https://studio.example/api/backup/restore/execute", {
    method: "POST",
    headers: { "sec-fetch-site": "same-origin", ...headers },
  });
}

function contextFor(kind: "owner" | "studio"): ApiAuthContext {
  return {
    user: {
      id: "1",
      displayName: "U",
      email: null,
      isOwner: kind === "owner",
      access: { portal: true, studio: true, brain: kind === "owner", family: kind === "owner" },
      aiAccess: false,
    },
    apiTokenId: null,
    apiTokenScopes: null,
    authMethod: "session",
  };
}

const NO_USER_CONTEXT: ApiAuthContext = {
  user: null,
  apiTokenId: null,
  apiTokenScopes: null,
  authMethod: "none",
};

describe("requireRestoreOwnerAuth (destructive restore owner gate)", () => {
  afterEach(() => {
    delete process.env.RESTORE_OWNER_TOKEN;
  });

  it("allows an authenticated owner session", () => {
    assert.equal(requireRestoreOwnerAuth(mockRestoreRequest(), contextFor("owner")), null);
  });

  it("rejects a Studio session even when RESTORE_OWNER_TOKEN is unset", () => {
    delete process.env.RESTORE_OWNER_TOKEN;
    const denied = requireRestoreOwnerAuth(mockRestoreRequest(), contextFor("studio"));
    assert.ok(denied);
    assert.equal(denied?.status, 403);
  });

  it("rejects an unauthenticated request when no owner token is configured", () => {
    delete process.env.RESTORE_OWNER_TOKEN;
    const denied = requireRestoreOwnerAuth(mockRestoreRequest(), NO_USER_CONTEXT);
    assert.ok(denied);
    assert.equal(denied?.status, 403);
  });

  it("allows headless automation with a valid RESTORE_OWNER_TOKEN bearer", () => {
    process.env.RESTORE_OWNER_TOKEN = "secret-owner-token";
    const ok = requireRestoreOwnerAuth(
      mockRestoreRequest({ authorization: "Bearer secret-owner-token" }),
      NO_USER_CONTEXT,
    );
    assert.equal(ok, null);
  });

  it("rejects a wrong RESTORE_OWNER_TOKEN bearer", () => {
    process.env.RESTORE_OWNER_TOKEN = "secret-owner-token";
    const denied = requireRestoreOwnerAuth(
      mockRestoreRequest({ authorization: "Bearer wrong-token" }),
      NO_USER_CONTEXT,
    );
    assert.ok(denied);
    assert.equal(denied?.status, 403);
  });

  it("still rejects a Studio session even if a valid owner token is present but the caller is a logged-in non-owner", () => {
    process.env.RESTORE_OWNER_TOKEN = "secret-owner-token";
    const denied = requireRestoreOwnerAuth(mockRestoreRequest(), contextFor("studio"));
    assert.ok(denied);
    assert.equal(denied?.status, 403);
  });
});
