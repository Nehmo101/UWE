import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { completePasswordReset, requestPasswordReset } from "./auth-password-reset";
import { createAuditLogService } from "./audit-log-service";
import { createUserService } from "./user-service";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";

describe("auth password reset flow", () => {
  let databaseUrl: string;
  let userId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const users = createUserService(db);

    const user = await users.createUser({
      displayName: "Reset Flow User",
      email: "reset-flow@uwe.local",
      password: "original-password",
      portalAccess: true,
      studioAccess: false,
      actorUserId: "bootstrap",
    });
    userId = user.id;

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("returns the same neutral message for unknown and known emails", async () => {
    const db = createPrismaClient(databaseUrl);
    const request = new Request("https://portal.example/login", {
      headers: { host: "portal.example" },
    });

    try {
      const unknown = await requestPasswordReset({
        db,
        email: "missing@uwe.local",
        request,
        surface: "portal",
      });
      const known = await requestPasswordReset({
        db,
        email: "reset-flow@uwe.local",
        request,
        surface: "portal",
      });

      assert.equal(unknown.ok, true);
      assert.equal(known.ok, true);
      assert.equal(unknown.message, known.message);
    } finally {
      await db.$disconnect();
    }
  });

  it("completes password reset with a valid token and invalidates sessions", async () => {
    const db = createPrismaClient(databaseUrl);
    const users = createUserService(db);
    const auth = createAuthService(db);
    const audit = createAuditLogService(db);
    const request = new Request("https://portal.example/reset-password", {
      headers: { host: "portal.example" },
    });

    try {
      const tokenResult = await users.createPasswordResetToken({
        email: "reset-flow@uwe.local",
      });
      assert.ok(tokenResult);

      const session = await auth.createSession(userId);
      assert.ok(await auth.getSessionByToken(session.token));

      const result = await completePasswordReset({
        db,
        email: "reset-flow@uwe.local",
        resetToken: tokenResult.resetToken,
        newPassword: "reset-token-password",
        request,
        surface: "portal",
      });

      assert.equal(result.ok, true);
      assert.equal(await auth.getSessionByToken(session.token), null);

      const oldLogin = await auth.authenticate("reset-flow@uwe.local", "original-password");
      assert.equal(oldLogin, null);

      const newLogin = await auth.authenticate("reset-flow@uwe.local", "reset-token-password");
      assert.ok(newLogin);

      const entries = await audit.list({ actions: ["password_reset"], limit: 20 });
      const match = entries.find((entry) => {
        if (entry.targetId !== userId) return false;
        const metadata = entry.metadataJson as { method?: string } | null;
        return metadata?.method === "reset_token";
      });
      assert.ok(match);
    } finally {
      await db.$disconnect();
    }
  });

  it("rejects invalid reset tokens without revealing account existence", async () => {
    const db = createPrismaClient(databaseUrl);
    const request = new Request("https://portal.example/reset-password", {
      headers: { host: "portal.example" },
    });

    try {
      const result = await completePasswordReset({
        db,
        email: "reset-flow@uwe.local",
        resetToken: "invalid-token",
        newPassword: "another-password",
        request,
        surface: "portal",
      });

      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.status, 400);
        assert.match(result.error, /Ungültiger oder abgelaufener Reset-Link/);
      }
    } finally {
      await db.$disconnect();
    }
  });
});
