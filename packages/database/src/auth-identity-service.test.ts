import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthIdentityService } from "./auth-identity-service";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";

describe("auth identity service", () => {
  let databaseUrl: string;
  let userId: string;
  let otherUserId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const user = await db.user.create({
      data: {
        displayName: "Google User",
        email: "google@uwe.local",
        passwordHash: "hash",
        portalAccess: true,
      },
    });
    const other = await db.user.create({
      data: {
        displayName: "Other User",
        email: "other@uwe.local",
        passwordHash: null,
        portalAccess: true,
      },
    });
    await db.user.create({
      data: {
        displayName: "Disabled User",
        email: "disabled@uwe.local",
        passwordHash: "hash",
        portalAccess: true,
        status: "disabled",
      },
    });
    userId = user.id;
    otherUserId = other.id;
    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("links an identity, finds it by provider id, and lists it", async () => {
    const db = createPrismaClient(databaseUrl);
    const identities = createAuthIdentityService(db);

    const linked = await identities.linkIdentity({
      userId,
      provider: "google",
      providerUserId: "sub-123",
      email: "google@uwe.local",
    });
    assert.equal(linked.conflict, false);

    const found = await identities.findByProvider("google", "sub-123");
    assert.equal(found?.userId, userId);
    assert.equal(found?.user.status, "active");

    const list = await identities.listForUser(userId);
    assert.equal(list.length, 1);
    assert.equal(list[0]?.provider, "google");

    assert.equal(await identities.findByProvider("google", "unknown-sub"), null);

    await db.$disconnect();
  });

  it("refuses to steal an identity already linked to another user", async () => {
    const db = createPrismaClient(databaseUrl);
    const identities = createAuthIdentityService(db);

    const conflict = await identities.linkIdentity({
      userId: otherUserId,
      provider: "google",
      providerUserId: "sub-123",
    });
    assert.equal(conflict.conflict, true);

    const stillOriginal = await identities.findByProvider("google", "sub-123");
    assert.equal(stillOriginal?.userId, userId);

    await db.$disconnect();
  });

  it("matches only active users by verified e-mail (lowercased)", async () => {
    const db = createPrismaClient(databaseUrl);
    const identities = createAuthIdentityService(db);

    const match = await identities.findActiveUserByVerifiedEmail("GOOGLE@uwe.local");
    assert.equal(match?.id, userId);

    assert.equal(await identities.findActiveUserByVerifiedEmail("disabled@uwe.local"), null);
    assert.equal(await identities.findActiveUserByVerifiedEmail("nobody@uwe.local"), null);

    await db.$disconnect();
  });

  it("enforces the unlink lockout guard via hasAlternativeLoginMethod", async () => {
    const db = createPrismaClient(databaseUrl);
    const identities = createAuthIdentityService(db);

    // userId has a password → alternative exists.
    assert.equal(await identities.hasAlternativeLoginMethod(userId), true);
    // otherUserId has neither password nor passkey.
    assert.equal(await identities.hasAlternativeLoginMethod(otherUserId), false);

    await db.webAuthnCredential.create({
      data: {
        userId: otherUserId,
        credentialId: "cred-alt",
        publicKey: "pk",
        rpId: "uwe.test",
        name: "Passkey",
      },
    });
    assert.equal(await identities.hasAlternativeLoginMethod(otherUserId), true);

    const removed = await identities.unlinkForUser(userId, "google");
    assert.equal(removed, true);
    assert.equal(await identities.unlinkForUser(userId, "google"), false);

    await db.$disconnect();
  });
});
