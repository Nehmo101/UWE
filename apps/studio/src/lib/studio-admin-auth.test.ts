import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "./studio-admin-auth";

function mockStudioRequest(path = "/api/admin/mail/sync"): Request {
  return new Request(`https://studio.example${path}`, {
    method: "POST",
    headers: {
      host: "studio.example",
      origin: "https://studio.example",
      "sec-fetch-site": "same-origin",
    },
  });
}

describe("resolveStudioApiAuthContext dev bypass", () => {
  it("returns owner dev-bypass user when AUTH_REQUIRED=false and no session", async () => {
    const previousAuth = process.env.AUTH_REQUIRED;
    process.env.AUTH_REQUIRED = "false";

    try {
      const context = await resolveStudioApiAuthContext(mockStudioRequest());
      assert.equal(context.user?.id, "dev-bypass");
      assert.equal(context.user?.isOwner, true);
      assert.equal(context.authMethod, "session");

      const denied = requireAdminApiAuth(mockStudioRequest(), context, {
        requiredScopes: ["mail_send"],
      });
      assert.equal(denied, null);
    } finally {
      if (previousAuth === undefined) delete process.env.AUTH_REQUIRED;
      else process.env.AUTH_REQUIRED = previousAuth;
    }
  });

  it("returns no user when AUTH_REQUIRED=true and no session", async () => {
    const previousAuth = process.env.AUTH_REQUIRED;
    process.env.AUTH_REQUIRED = "true";

    try {
      const context = await resolveStudioApiAuthContext(mockStudioRequest());
      assert.equal(context.user, null);
      assert.equal(context.authMethod, "none");

      const denied = requireAdminApiAuth(mockStudioRequest(), context, {
        requiredScopes: ["mail_send"],
      });
      assert.ok(denied);
      assert.equal(denied?.status, 401);
    } finally {
      if (previousAuth === undefined) delete process.env.AUTH_REQUIRED;
      else process.env.AUTH_REQUIRED = previousAuth;
    }
  });
});
