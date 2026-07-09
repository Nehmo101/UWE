import { createPrismaClient } from "./client";
import { hashOpaqueToken } from "@uwe/auth/server";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { listActiveSessionsForUser } from "./account-session-service";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUserService } from "./user-service";

describe("account-session-service", () => {
  let databaseUrl: string;
  let userId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const users = createUserService(db);

    const user = await users.createUser({
      displayName: "Session Viewer",
      email: "session-viewer@uwe.local",
      password: "session-password",
      role: "player",
      actorUserId: "bootstrap",
    });
    userId = user.id;

    await db.$disconnect();
  });

  it("lists only active sessions with IP and current marker", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const current = await auth.createSession(userId, { ipAddress: "203.0.113.10" });
    const other = await auth.createSession(userId, { ipAddress: "198.51.100.2" });

    await db.session.update({
      where: { id: other.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const sessions = await listActiveSessionsForUser(db, userId, {
      currentSessionId: current.id,
    });

    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.id, current.id);
    assert.equal(sessions[0]?.ipAddress, "203.0.113.10");
    assert.equal(sessions[0]?.isCurrent, true);

    const stored = await db.session.findUnique({ where: { id: current.id } });
    assert.ok(stored);
    assert.equal(stored.tokenHash, hashOpaqueToken(current.token));

    await db.$disconnect();
  });
});
