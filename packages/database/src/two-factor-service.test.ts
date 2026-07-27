import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { generateTotpCode, hashOpaqueToken } from "@uwe/auth/server";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import { createTwoFactorService } from "./two-factor-service";

/**
 * Liefert einen strukturell gültigen 6-stelligen Code, der garantiert
 * außerhalb des ±1-Zeitfensters liegt (also von verifyTotpCode als falsch
 * gewertet wird), unabhängig vom realen Zeitpunkt der Prüfung.
 */
function pickWrongCode(secret: string, counter: number): string {
  const windowCodes = new Set([
    generateTotpCode(secret, counter - 1),
    generateTotpCode(secret, counter),
    generateTotpCode(secret, counter + 1),
  ]);
  for (let candidate = 0; candidate < 1_000_000; candidate += 1) {
    const code = String(candidate).padStart(6, "0");
    if (!windowCodes.has(code)) {
      return code;
    }
  }
  throw new Error("no wrong code available");
}

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
        isOwner: true,
        portalAccess: true,
        studioAccess: true,
        brainAccess: true,
        familyAccess: true,
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

  it("rejects an expired login challenge even with a valid code", async () => {
    const db = createPrismaClient(databaseUrl);
    const twoFactor = createTwoFactorService(db);

    const setup = await twoFactor.beginSetup(userId, "2fa@uwe.local");
    const counter = Math.floor(Date.now() / 1000 / 30);
    const code = generateTotpCode(setup.secret, counter);
    await twoFactor.confirmSetup(userId, code);

    const challenge = await twoFactor.createLoginChallenge(userId);
    // Challenge manuell in die Vergangenheit ablaufen lassen.
    await db.twoFactorChallenge.update({
      where: { challengeTokenHash: hashOpaqueToken(challenge.challengeToken) },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    // Trotz gültigem Code muss das Ergebnis null sein (Ablauf-Zweig).
    const result = await twoFactor.verifyLoginChallenge(challenge.challengeToken, code);
    assert.equal(result, null);

    await db.$disconnect();
  });

  it("rejects a wrong code without consuming the challenge", async () => {
    const db = createPrismaClient(databaseUrl);
    const twoFactor = createTwoFactorService(db);

    const setup = await twoFactor.beginSetup(userId, "2fa@uwe.local");
    const counter = Math.floor(Date.now() / 1000 / 30);
    const validCode = generateTotpCode(setup.secret, counter);
    await twoFactor.confirmSetup(userId, validCode);

    const challenge = await twoFactor.createLoginChallenge(userId);
    const wrongCode = pickWrongCode(setup.secret, counter);

    const rejected = await twoFactor.verifyLoginChallenge(challenge.challengeToken, wrongCode);
    assert.equal(rejected, null);

    // Die Challenge darf nach einem falschen Code nicht verbraucht sein …
    const stored = await db.twoFactorChallenge.findUnique({
      where: { challengeTokenHash: hashOpaqueToken(challenge.challengeToken) },
      select: { consumedAt: true },
    });
    assert.equal(stored?.consumedAt, null);

    // … und mit dem korrekten Code weiterhin einlösbar sein.
    const accepted = await twoFactor.verifyLoginChallenge(challenge.challengeToken, validCode);
    assert.ok(accepted);
    assert.equal(accepted?.userId, userId);

    await db.$disconnect();
  });

  it("does not enable 2FA when confirmSetup receives a wrong code", async () => {
    const db = createPrismaClient(databaseUrl);
    const twoFactor = createTwoFactorService(db);

    const setup = await twoFactor.beginSetup(userId, "2fa@uwe.local");
    const counter = Math.floor(Date.now() / 1000 / 30);
    const wrongCode = pickWrongCode(setup.secret, counter);

    assert.equal(await twoFactor.confirmSetup(userId, wrongCode), false);
    assert.equal(await twoFactor.isEnabled(userId), false);

    // Gegenprobe: mit dem korrekten Code lässt sich 2FA aktivieren.
    const validCode = generateTotpCode(setup.secret, counter);
    assert.equal(await twoFactor.confirmSetup(userId, validCode), true);
    assert.equal(await twoFactor.isEnabled(userId), true);

    await db.$disconnect();
  });
});
