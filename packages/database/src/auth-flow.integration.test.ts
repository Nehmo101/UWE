/**
 * Auth flow integration tests — setup, login, 2FA challenge paths.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { generateTotpCode } from "@uwe/auth/server";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import { createTwoFactorService } from "./two-factor-service";

describe("auth flow integration", () => {
  let databaseUrl: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    process.env.SESSION_SECRET = "auth-flow-integration-secret";
  });

  after(async () => {
    delete process.env.SESSION_SECRET;
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("completes owner setup once and blocks second owner", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    assert.equal(await auth.isSetupAvailable(), true);
    const owner = await auth.createOwnerViaSetup({
      displayName: "Flow Owner",
      email: "flow-owner@uwe.local",
      password: "setup-password-1",
    });
    assert.equal(owner.role, "owner");
    assert.equal(await auth.isSetupAvailable(), false);

    await assert.rejects(
      () =>
        auth.createOwnerViaSetup({
          displayName: "Second",
          email: "second@uwe.local",
          password: "setup-password-2",
        }),
      /SETUP_DISABLED/,
    );

    await db.$disconnect();
  });

  it("requires 2FA after password login when enabled", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const twoFactor = createTwoFactorService(db);

    const user = await auth.authenticate("flow-owner@uwe.local", "setup-password-1");
    assert.ok(user);

    const setup = await twoFactor.beginSetup(user.id, "flow-owner@uwe.local");
    const counter = Math.floor(Date.now() / 1000 / 30);
    const code = generateTotpCode(setup.secret, counter);
    assert.equal(await twoFactor.confirmSetup(user.id, code), true);

    assert.equal(await twoFactor.isEnabled(user.id), true);

    const challenge = await twoFactor.createLoginChallenge(user.id);
    const verified = await twoFactor.verifyLoginChallenge(challenge.challengeToken, code);
    assert.ok(verified);
    assert.equal(verified?.userId, user.id);

    const session = await auth.createSession(user.id);
    assert.ok(await auth.getSessionByToken(session.token));
    await auth.deleteSession(session.token);

    await db.$disconnect();
  });
});
