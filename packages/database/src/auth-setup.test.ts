import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { verifyPassword } from "@uwe/auth/server";
import { createAuthService, DUMMY_PASSWORD_HASH, MAX_FAILED_LOGINS } from "./auth";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";

describe("owner bootstrap setup", () => {
  let databaseUrl: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    process.env.DATABASE_URL = databaseUrl;
  });

  after(async () => {
    delete process.env.DATABASE_URL;
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("allows creating the first owner once", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    assert.equal(await auth.isSetupAvailable(), true);

    const owner = await auth.createOwnerViaSetup({
      displayName: "Bootstrap Owner",
      email: "owner@uwe.local",
      password: "secure-password-1",
    });

    assert.equal(owner.isOwner, true);
    assert.deepEqual(owner.access, { portal: true, studio: true, brain: true, family: true });
    assert.equal(await auth.hasOwnerUser(), true);
    assert.equal(await auth.isSetupAvailable(), false);

    await db.$disconnect();
  });

  it("rejects setup after an owner exists", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    await assert.rejects(
      () =>
        auth.createOwnerViaSetup({
          displayName: "Second Owner",
          email: "other@uwe.local",
          password: "secure-password-2",
        }),
      /SETUP_DISABLED/,
    );

    await db.$disconnect();
  });

  it("returns setupAvailable false after owner bootstrap", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    assert.equal(await auth.isSetupAvailable(), false);

    await db.$disconnect();
  });

  it("authenticates with hashed password and rejects wrong password generically", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const ok = await auth.authenticate("owner@uwe.local", "secure-password-1");
    assert.ok(ok);
    assert.equal(ok.hasPassword, true);
    assert.equal("passwordHash" in ok, false);

    const bad = await auth.authenticate("owner@uwe.local", "wrong-password");
    assert.equal(bad, null);

    await db.$disconnect();
  });

  it("returns null for unknown and disabled accounts (timing-equalized)", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    // Unknown e-mail must not short-circuit before the scrypt cost is paid.
    assert.equal(await auth.authenticate("nobody@uwe.local", "whatever"), null);

    await db.user.update({
      where: { email: "owner@uwe.local" },
      data: { status: "disabled" },
    });
    assert.equal(await auth.authenticate("owner@uwe.local", "secure-password-1"), null);
    await db.user.update({
      where: { email: "owner@uwe.local" },
      data: { status: "active" },
    });

    await db.$disconnect();
  });

  it("locks the account after MAX_FAILED_LOGINS and clears on reset", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const user = await db.user.findUniqueOrThrow({ where: { email: "owner@uwe.local" } });

    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
      await auth.recordFailedLogin(user.id);
    }

    const locked = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(locked.failedLoginCount, MAX_FAILED_LOGINS);
    assert.ok(locked.lockedUntil && locked.lockedUntil.getTime() > Date.now());

    await auth.resetFailedLogins(user.id);
    const cleared = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(cleared.failedLoginCount, 0);
    assert.equal(cleared.lockedUntil, null);

    await db.$disconnect();
  });

  it("keeps the dummy hash in valid scrypt format so verifyPassword runs the KDF", async () => {
    // A malformed hash would make verifyPassword return false *before* scrypt,
    // silently reintroducing the enumeration timing oracle. Pin the shape.
    assert.match(DUMMY_PASSWORD_HASH, /^scrypt:v1:[0-9a-f]{32}:[0-9a-f]{128}$/);
    assert.equal(await verifyPassword("any-password", DUMMY_PASSWORD_HASH), false);
  });
});
