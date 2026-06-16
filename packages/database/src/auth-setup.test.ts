import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
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

    assert.equal(owner.role, "owner");
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

  it("authenticates with hashed password and rejects wrong password generically", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const ok = await auth.authenticate("owner@uwe.local", "secure-password-1");
    assert.ok(ok);
    assert.ok(ok.passwordHash);
    assert.notEqual(ok.passwordHash, "secure-password-1");

    const bad = await auth.authenticate("owner@uwe.local", "wrong-password");
    assert.equal(bad, null);

    await db.$disconnect();
  });
});
