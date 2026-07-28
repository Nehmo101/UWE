/**
 * PostgreSQL smoke test — runs when POSTGRES_TEST_URL is set (CI postgres job).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { isPostgresDatabaseUrl } from "./database-provider";

const postgresUrl = process.env.POSTGRES_TEST_URL?.trim();

describe("postgres smoke", { skip: !postgresUrl }, () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = postgresUrl!;
    assert.ok(isPostgresDatabaseUrl(databaseUrl));
    process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? `pg-smoke-${"x".repeat(28)}`;
  });

  after(async () => {
    const db = createPrismaClient(databaseUrl);
    await db.$disconnect();
  });

  it("connects and runs owner setup flow", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    assert.equal(await auth.isSetupAvailable(), true);
    const owner = await auth.createOwnerViaSetup({
      displayName: "Postgres Owner",
      email: "postgres-owner@uwe.local",
      password: "postgres-test-password",
    });
    assert.equal(owner.isOwner, true);
    assert.equal(await auth.isSetupAvailable(), false);

    const session = await auth.createSession(owner.id);
    assert.ok(await auth.getSessionByToken(session.token));
    await auth.deleteSession(session.token);

    await db.$disconnect();
  });
});
