import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { generateTotpCode } from "@uwe/auth/server";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import { createTwoFactorService } from "./two-factor-service";

describe("two-factor service", () => {
  let databaseUrl: string;
  let userId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    process.env.SESSION_SECRET = "two-factor-test-secret";
    const db = createPrismaClient(databaseUrl);
    const user = await db.user.create({
      data: {
        displayName: "2FA User",
        email: "2fa@uwe.local",
        passwordHash: "hash",
        role: "owner",
      },
    });
    userId = user.id;
    await db.$disconnect();
  });

  after(async () => {
    delete process.env.SESSION_SECRET;
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("enables TOTP after confirmation and verifies login challenges", async () => {
    const db = createPrismaClient(databaseUrl);
    const twoFactor = createTwoFactorService(db);

    const setup = await twoFactor.beginSetup(userId, "2fa@uwe.local");
    const counter = Math.floor(Date.now() / 1000 / 30);
    const code = generateTotpCode(setup.secret, counter);
    assert.equal(await twoFactor.confirmSetup(userId, code), true);
    assert.equal(await twoFactor.isEnabled(userId), true);

    const challenge = await twoFactor.createLoginChallenge(userId);
    const verified = await twoFactor.verifyLoginChallenge(challenge.challengeToken, code);
    assert.ok(verified);
    assert.equal(verified?.userId, userId);

    const replay = await twoFactor.verifyLoginChallenge(challenge.challengeToken, code);
    assert.equal(replay, null);

    await db.$disconnect();
  });

  it("removes secret and open challenges atomically on disable", async () => {
    const db = createPrismaClient(databaseUrl);
    const twoFactor = createTwoFactorService(db);

    const setup = await twoFactor.beginSetup(userId, "2fa@uwe.local");
    const counter = Math.floor(Date.now() / 1000 / 30);
    const code = generateTotpCode(setup.secret, counter);
    await twoFactor.confirmSetup(userId, code);
    await twoFactor.createLoginChallenge(userId);

    await twoFactor.disable(userId);

    assert.equal(await twoFactor.isEnabled(userId), false);
    const remainingChallenges = await db.twoFactorChallenge.count({ where: { userId } });
    assert.equal(remainingChallenges, 0);

    await db.$disconnect();
  });
});
