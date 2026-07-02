import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import {
  parseUserRoleToken,
  parseWorldMemberRoleToken,
  resolveUserQuery,
  resolveWorldQuery,
} from "./nl-command-entity-resolver";
import { createTestDatabaseUrl } from "./test-helpers";

describe("nl-command-entity-resolver", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  it("parses world member role aliases", () => {
    assert.equal(parseWorldMemberRoleToken("spielerin"), "player");
    assert.equal(parseWorldMemberRoleToken("co-dm"), "co_dm");
    assert.equal(parseWorldMemberRoleToken("dm"), "dm");
  });

  it("parses global user role aliases", () => {
    assert.equal(parseUserRoleToken("spieler"), "player");
    assert.equal(parseUserRoleToken("admin"), "admin");
    assert.equal(parseUserRoleToken("Administrator"), "admin");
    assert.equal(parseUserRoleToken("Spielleiterin"), "dm");
    assert.equal(parseUserRoleToken("read-only"), "readonly");
    assert.equal(parseUserRoleToken("besitzer"), "owner");
    assert.equal(parseUserRoleToken("superheld"), null);
  });

  it("resolves users by email and display name", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    await auth.createUser({
      displayName: "Carina Test",
      email: "carina-resolver@example.com",
      password: "test-password-123",
      role: "player",
    });

    const byEmail = await resolveUserQuery(db, "carina-resolver@example.com");
    assert.equal(byEmail.ok, true);
    if (byEmail.ok) {
      assert.equal(byEmail.entity.displayName, "Carina Test");
    }

    const byName = await resolveUserQuery(db, "Carina");
    assert.equal(byName.ok, true);

    await db.$disconnect();
  });

  it("resolves worlds by slug and name", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "World Resolver Owner",
      email: "world-resolver-owner@example.com",
      password: "test-password-123",
      role: "owner",
    });
    void owner;

    await db.world.create({
      data: {
        name: "Resolver Terra",
        slug: "resolver-terra",
      },
    });

    const bySlug = await resolveWorldQuery(db, "resolver-terra");
    assert.equal(bySlug.ok, true);

    const byName = await resolveWorldQuery(db, "Resolver Terra");
    assert.equal(byName.ok, true);

    await db.$disconnect();
  });
});
