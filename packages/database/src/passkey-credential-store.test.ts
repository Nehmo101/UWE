import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createPasskeyCredentialStore } from "./passkey-credential-store";
import { createTestDatabaseUrl } from "./test-helpers";

describe("passkey credential store", () => {
  let databaseUrl: string;
  let userId: string;
  let otherUserId: string;
  let disabledUserId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const user = await db.user.create({
      data: {
        displayName: "Passkey User",
        email: "passkey@uwe.local",
        passwordHash: "hash",
        role: "dm",
      },
    });
    const other = await db.user.create({
      data: {
        displayName: "Other User",
        email: "other@uwe.local",
        passwordHash: "hash",
        role: "player",
      },
    });
    const disabled = await db.user.create({
      data: {
        displayName: "Disabled User",
        email: "disabled@uwe.local",
        passwordHash: "hash",
        role: "player",
        status: "disabled",
      },
    });
    userId = user.id;
    otherUserId = other.id;
    disabledUserId = disabled.id;
    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("consumes a challenge exactly once and rejects wrong types", async () => {
    const db = createPrismaClient(databaseUrl);
    const store = createPasskeyCredentialStore(db);

    await store.persistChallenge({ challenge: "challenge-one", type: "authentication" });

    assert.equal(await store.consumeChallenge("challenge-one", "registration"), null);

    const consumed = await store.consumeChallenge("challenge-one", "authentication");
    assert.ok(consumed);
    assert.equal(consumed?.userId, null);

    const replay = await store.consumeChallenge("challenge-one", "authentication");
    assert.equal(replay, null);

    await db.$disconnect();
  });

  it("binds registration challenges to a user and enforces expiry", async () => {
    const db = createPrismaClient(databaseUrl);
    const store = createPasskeyCredentialStore(db);

    await store.persistChallenge({ challenge: "reg-challenge", type: "registration", userId });
    const consumed = await store.consumeChallenge("reg-challenge", "registration");
    assert.equal(consumed?.userId, userId);

    await store.persistChallenge({
      challenge: "expired-challenge",
      type: "authentication",
      ttlMs: -1,
    });
    assert.equal(await store.consumeChallenge("expired-challenge", "authentication"), null);

    await db.$disconnect();
  });

  it("stores credentials and returns them for login with transports parsed", async () => {
    const db = createPrismaClient(databaseUrl);
    const store = createPasskeyCredentialStore(db);

    const created = await store.insertCredential({
      userId,
      credentialId: "cred-login",
      publicKey: "pk-login",
      counter: 3,
      transports: ["internal", "hybrid"],
      deviceType: "multiDevice",
      backedUp: true,
      rpId: "uwe.test",
      name: "iPhone",
    });
    assert.equal(created.name, "iPhone");

    const found = await store.findByCredentialIdForLogin("cred-login");
    assert.ok(found);
    assert.equal(found?.userId, userId);
    assert.deepEqual(found?.transports, ["internal", "hybrid"]);
    assert.equal(found?.user.status, "active");
    assert.equal(found?.rpId, "uwe.test");

    await store.updateAfterLogin(created.id, 4);
    const updated = await store.findByCredentialIdForLogin("cred-login");
    assert.equal(updated?.counter, 4);

    assert.equal(await store.findByCredentialIdForLogin("unknown-cred"), null);

    await db.$disconnect();
  });

  it("refuses login lookups for disabled users", async () => {
    const db = createPrismaClient(databaseUrl);
    const store = createPasskeyCredentialStore(db);

    await store.insertCredential({
      userId: disabledUserId,
      credentialId: "cred-disabled",
      publicKey: "pk-disabled",
      counter: 0,
      rpId: "uwe.test",
      name: "Altes Gerät",
    });

    assert.equal(await store.findByCredentialIdForLogin("cred-disabled"), null);

    await db.$disconnect();
  });

  it("scopes deletion to the owning user", async () => {
    const db = createPrismaClient(databaseUrl);
    const store = createPasskeyCredentialStore(db);

    const created = await store.insertCredential({
      userId,
      credentialId: "cred-delete",
      publicKey: "pk-delete",
      counter: 0,
      rpId: "uwe.test",
      name: "Laptop",
    });

    assert.equal(await store.deleteForUser(otherUserId, created.id), false);
    assert.equal(await store.deleteForUser(userId, created.id), true);
    assert.equal(await store.deleteForUser(userId, created.id), false);

    const ids = await store.listCredentialIdsForUser(userId);
    assert.equal(ids.includes("cred-delete"), false);

    await db.$disconnect();
  });
});
