import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { hashPassword, hashOpaqueToken } from "@uwe/auth/server";
import { createAuthService } from "./auth";
import { createAuditLogService } from "./audit-log-service";
import { createUserService } from "./user-service";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";

function assertNoSensitiveUserFields(payload: unknown, label: string): void {
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("passwordHash"), false, `${label} leaked passwordHash`);
  assert.equal(serialized.includes("resetTokenHash"), false, `${label} leaked resetTokenHash`);
  assert.equal(serialized.includes("inviteTokenHash"), false, `${label} leaked inviteTokenHash`);
  assert.equal(serialized.includes("twoFactorSecret"), false, `${label} leaked twoFactorSecret`);
}

describe("password security", () => {
  let databaseUrl: string;
  let adminUserId: string;
  let targetUserId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const users = createUserService(db);

    const admin = await users.createUser({
      displayName: "Security Admin",
      email: "admin-security@uwe.local",
      password: "admin-password-1",
      role: "admin",
      actorUserId: "bootstrap",
    });
    adminUserId = admin.id;

    const target = await users.createUser({
      displayName: "Target User",
      email: "target-security@uwe.local",
      password: "original-password",
      role: "player",
      actorUserId: adminUserId,
    });
    targetUserId = target.id;

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("stores hashed passwords on user creation", async () => {
    const db = createPrismaClient(databaseUrl);
    const row = await db.user.findUnique({ where: { email: "target-security@uwe.local" } });

    assert.ok(row?.passwordHash);
    assert.match(row.passwordHash, /^scrypt:v1:/);
    assert.equal(row.passwordHash.includes("original-password"), false);

    await db.$disconnect();
  });

  it("authenticates with correct password and rejects wrong password", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const ok = await auth.authenticate("target-security@uwe.local", "original-password");
    assert.ok(ok);
    assert.equal(ok.displayName, "Target User");
    assertNoSensitiveUserFields(ok, "authenticate success");

    const bad = await auth.authenticate("target-security@uwe.local", "wrong-password");
    assert.equal(bad, null);

    await db.$disconnect();
  });

  it("returns SafeUser from admin list/detail APIs without passwordHash", async () => {
    const db = createPrismaClient(databaseUrl);
    const users = createUserService(db);

    const list = await users.listUsers();
    assert.ok(list.length >= 2);
    assertNoSensitiveUserFields(list, "listUsers");

    const detail = await users.getUserById(targetUserId);
    assert.ok(detail);
    assert.equal(detail.hasPassword, true);
    assertNoSensitiveUserFields(detail, "getUserById");

    await db.$disconnect();
  });

  it("admin password reset clears sessions and writes audit log", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const users = createUserService(db);
    const audit = createAuditLogService(db);

    const session = await auth.createSession(targetUserId);
    assert.ok(await auth.getSessionByToken(session.token));

    const resetOk = await users.resetPassword({
      userId: targetUserId,
      newPassword: "new-secure-password",
      actorUserId: adminUserId,
      forcePasswordChange: true,
    });
    assert.equal(resetOk, true);
    assert.equal(await auth.getSessionByToken(session.token), null);

    const oldLogin = await auth.authenticate("target-security@uwe.local", "original-password");
    assert.equal(oldLogin, null);

    const newLogin = await auth.authenticate("target-security@uwe.local", "new-secure-password");
    assert.ok(newLogin);

    const entries = await audit.list({ actions: ["password_reset"], limit: 20 });
    const match = entries.find((entry) => entry.targetId === targetUserId);
    assert.ok(match);
    assertNoSensitiveUserFields(match?.metadataJson, "password_reset audit");

    const updated = await users.getUserById(targetUserId);
    assert.equal(updated?.forcePasswordChange, true);

    await db.$disconnect();
  });

  it("admin cannot read password hash via safe user APIs", async () => {
    const db = createPrismaClient(databaseUrl);
    const users = createUserService(db);

    const user = await users.getUserById(targetUserId);
    assert.ok(user);
    assert.equal("passwordHash" in user, false);
    assert.equal(user.hasPassword, true);

    await db.$disconnect();
  });

  it("invite tokens are stored hashed and cleared after acceptance", async () => {
    const db = createPrismaClient(databaseUrl);
    const users = createUserService(db);

    const invited = await users.createInvite({
      displayName: "Invited User",
      email: "invited-security@uwe.local",
      role: "player",
      actorUserId: adminUserId,
    });

    assertNoSensitiveUserFields(invited.user, "createInvite user");
    assert.match(invited.inviteToken, /^[a-f0-9]{64}$/);

    const stored = await db.user.findUnique({ where: { email: "invited-security@uwe.local" } });
    assert.ok(stored?.inviteTokenHash);
    assert.equal(stored.inviteTokenHash, hashOpaqueToken(invited.inviteToken));
    assert.equal(stored.inviteTokenHash.includes(invited.inviteToken), false);

    const accepted = await users.acceptInvite({
      email: "invited-security@uwe.local",
      inviteToken: invited.inviteToken,
      password: "invite-password-1",
    });
    assert.ok(accepted);
    assertNoSensitiveUserFields(accepted, "acceptInvite");

    const after = await db.user.findUnique({ where: { email: "invited-security@uwe.local" } });
    assert.equal(after?.inviteTokenHash, null);
    assert.ok(after?.passwordHash);
    assert.match(after.passwordHash, /^scrypt:v1:/);

    await db.$disconnect();
  });

  it("logs user creation without password or hash metadata", async () => {
    const db = createPrismaClient(databaseUrl);
    const users = createUserService(db);
    const audit = createAuditLogService(db);

    const created = await users.createUser({
      displayName: "Audit User",
      email: "audit-password@uwe.local",
      password: "audit-password-123",
      role: "player",
      actorUserId: adminUserId,
    });

    const entries = await audit.list({ actions: ["user_created"], limit: 50 });
    const match = entries.find((entry) => entry.targetId === created.id);
    assert.ok(match);

    const serialized = JSON.stringify(match?.metadataJson ?? {});
    assert.equal(serialized.includes("audit-password-123"), false);
    assert.equal(serialized.includes("passwordHash"), false);

    await db.$disconnect();
  });

  it("upgrades legacy password hashes on successful login", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const legacyHash = await hashPassword("legacy-login-password");
    const [, , salt, hashHex] = legacyHash.split(":");
    const legacyStored = `${salt}:${hashHex}`;

    const legacyUser = await db.user.create({
      data: {
        displayName: "Legacy User",
        email: "legacy-login@uwe.local",
        passwordHash: legacyStored,
        role: "player",
      },
    });

    const authenticated = await auth.authenticate("legacy-login@uwe.local", "legacy-login-password");
    assert.ok(authenticated);

    const row = await db.user.findUnique({ where: { id: legacyUser.id } });
    assert.ok(row?.passwordHash?.startsWith("scrypt:v1:"));

    await db.$disconnect();
  });

  it("lets users change their own password and invalidates other sessions", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const users = createUserService(db);
    const audit = createAuditLogService(db);

    const sessionA = await auth.createSession(targetUserId);
    const sessionB = await auth.createSession(targetUserId);

    const result = await users.changePassword({
      userId: targetUserId,
      currentPassword: "new-secure-password",
      newPassword: "self-changed-password",
      keepSessionToken: sessionA.token,
    });
    assert.equal(result, "ok");

    assert.ok(await auth.getSessionByToken(sessionA.token));
    assert.equal(await auth.getSessionByToken(sessionB.token), null);

    const oldLogin = await auth.authenticate("target-security@uwe.local", "new-secure-password");
    assert.equal(oldLogin, null);

    const newLogin = await auth.authenticate("target-security@uwe.local", "self-changed-password");
    assert.ok(newLogin);

    const entries = await audit.list({ actions: ["password_changed"], limit: 20 });
    const match = entries.find((entry) => entry.targetId === targetUserId);
    assert.ok(match);
    assertNoSensitiveUserFields(match?.metadataJson, "password_changed audit");

    await db.$disconnect();
  });

  it("rejects self-service password change with wrong current password", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const users = createUserService(db);

    const result = await users.changePassword({
      userId: targetUserId,
      currentPassword: "wrong-current-password",
      newPassword: "another-new-password",
    });
    assert.equal(result, "invalid_current");

    const login = await auth.authenticate("target-security@uwe.local", "self-changed-password");
    assert.ok(login);

    await db.$disconnect();
  });
});
