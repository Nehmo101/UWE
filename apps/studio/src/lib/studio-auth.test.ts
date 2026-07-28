import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { canAccessStudio, getSessionCookieOptions, isOwner } from "@uwe/auth";
import { requireStudioApiAuth } from "./studio-api-auth";

function makeRequest(
  headers: Record<string, string> = {},
  url = "http://studio.local/api/admin/status",
): Request {
  return new Request(url, {
    method: "GET",
    headers,
  });
}

describe("studio auth integration", () => {
  let databaseUrl: string;
  let dmSessionToken: string;
  let playerSessionToken: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    process.env.DATABASE_URL = databaseUrl;
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const dm = await auth.createUser({
      displayName: "DM",
      email: "dm@test.local",
      password: "correct-password",
      portalAccess: true,
      studioAccess: true,
    });
    const player = await auth.createUser({
      displayName: "Player",
      email: "player@test.local",
      password: "correct-password",
      portalAccess: true,
      studioAccess: false,
    });

    dmSessionToken = (await auth.createSession(dm.id)).token;
    playerSessionToken = (await auth.createSession(player.id)).token;

    await db.$disconnect();
  });

  after(async () => {
    delete process.env.STUDIO_API_TOKEN;
    delete process.env.DATABASE_URL;
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("uses httpOnly session cookies in production config", () => {
    const options = getSessionCookieOptions({
      NODE_ENV: "production",
      SESSION_COOKIE_SECURE: "true",
      SESSION_COOKIE_SAMESITE: "lax",
    });

    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, "lax");
  });

  it("gates Studio on the checkbox and admin on the owner flag", () => {
    const dm = { isOwner: false, access: { portal: true, studio: true, brain: false, family: false } };
    const player = { isOwner: false, access: { portal: true, studio: false, brain: false, family: false } };
    const owner = { isOwner: true, access: { portal: true, studio: true, brain: true, family: true } };

    assert.ok(canAccessStudio(dm));
    assert.ok(!canAccessStudio(player));
    assert.ok(isOwner(owner));
    assert.ok(!isOwner(dm));
  });

  it("blocks cross-site browser API requests via CSRF guard", () => {
    const result = requireStudioApiAuth(
      new Request("http://studio.local/api/admin/status", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site", host: "studio.local" },
      }),
    );
    assert.ok(result);
    assert.equal(result.status, 403);
  });

  it("allows same-origin requests without configured API token", () => {
    const result = requireStudioApiAuth(
      makeRequest({ "sec-fetch-site": "same-origin", host: "studio.local" }),
    );
    assert.equal(result, null);
  });

  it("creates distinct sessions for a DM and a player", () => {
    assert.notEqual(dmSessionToken, playerSessionToken);
    assert.ok(dmSessionToken.length > 0);
    assert.ok(playerSessionToken.length > 0);
  });
});
