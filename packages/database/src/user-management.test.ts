import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { evaluatePortalMiddleware } from "@uwe/auth";
import { evaluateAdminGate } from "@uwe/auth";
import { createAuthService } from "./auth";
import { createUserService } from "./user-service";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

const TEST_PASSWORD = "user-mgmt-test-pass";

describe("user management and login hardening", () => {
  let databaseUrl: string;
  let auth: ReturnType<typeof createAuthService>;
  let repo: ReturnType<typeof createUweRepository>;
  let worldASlug: string;
  let worldBSlug: string;
  let adminUserId: string;
  let playerUserId: string;
  let playerEmail: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    auth = createAuthService(db);
    repo = createUweRepository(databaseUrl);

    const worldA = await repo.createWorld({
      name: "User Mgmt A",
      slug: "user-mgmt-a",
      description: "Primary test world",
    });
    const worldB = await repo.createWorld({
      name: "User Mgmt B",
      slug: "user-mgmt-b",
      description: "Secondary test world",
    });
    worldASlug = worldA.slug;
    worldBSlug = worldB.slug;

    await auth.setWorldGuestMode(worldA.id, false);
    await auth.setWorldGuestMode(worldB.id, false);

    const admin = await auth.createUser({
      displayName: "Mgmt Admin",
      email: "mgmt-admin@uwe.local",
      password: TEST_PASSWORD,
      role: "admin",
      status: "active",
    });
    adminUserId = admin.id;

    const player = await auth.createUser({
      displayName: "Mgmt Player",
      email: "mgmt-player@uwe.local",
      password: TEST_PASSWORD,
      role: "player",
      status: "active",
    });
    playerUserId = player.id;
    playerEmail = player.email!;

    await auth.upsertWorldMembership({
      userId: playerUserId,
      worldId: worldA.id,
      role: "player",
      characterName: "Testchar",
    });

    await repo.createPage({
      worldId: worldA.id,
      title: "Player Lore",
      slug: "player-lore",
      type: "note",
      contentBlocks: [
        {
          type: "player_text",
          sortOrder: 0,
          content: "Known to players.",
        },
      ],
    });

    await repo.createPage({
      worldId: worldA.id,
      title: "Specific Secret",
      slug: "specific-secret",
      type: "note",
      contentBlocks: [
        {
          type: "player_text",
          sortOrder: 0,
          content: "Only for granted players.",
        },
      ],
    });

    const specificPage = await repo.getPageBySlug(worldASlug, "specific-secret");
    assert.ok(specificPage);

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("rejects login for unknown email", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createAuthService(db);
    const result = await service.authenticate("unknown@uwe.local", TEST_PASSWORD);
    assert.equal(result, null);
    await db.$disconnect();
  });

  it("rejects login for disabled users", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createAuthService(db);

    const disabled = await service.createUser({
      displayName: "Disabled User",
      email: "disabled@uwe.local",
      password: TEST_PASSWORD,
      role: "player",
      status: "active",
    });
    await service.disableUser(disabled.id, adminUserId);

    const result = await service.authenticate("disabled@uwe.local", TEST_PASSWORD);
    assert.equal(result, null);
    await db.$disconnect();
  });

  it("updates lastLoginAt on successful login flow", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createAuthService(db);

    const user = await service.authenticate(playerEmail, TEST_PASSWORD);
    assert.ok(user);
    await service.recordSuccessfulLogin(user.id);

    const refreshed = await service.findUserById(user.id);
    assert.ok(refreshed?.lastLoginAt);
    await db.$disconnect();
  });

  it("lets admin create and disable users and clears sessions", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createUserService(db);
    const auth = createAuthService(db);

    const created = await auth.createUser({
      displayName: "Temp Player",
      email: "temp-player@uwe.local",
      password: TEST_PASSWORD,
      role: "player",
      status: "active",
    });

    const session = await auth.createSession(created.id);
    const activeBefore = await auth.getSessionByToken(session.token);
    assert.ok(activeBefore);

    await service.disableUser(created.id, adminUserId);

    const activeAfter = await auth.getSessionByToken(session.token);
    assert.equal(activeAfter, null);

    const disabled = await auth.findUserById(created.id);
    assert.equal(disabled?.status, "disabled");
    await db.$disconnect();
  });

  it("lets admin permanently delete non-owner users", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createUserService(db);
    const auth = createAuthService(db);

    const created = await auth.createUser({
      displayName: "Delete Me",
      email: "delete-me@uwe.local",
      password: TEST_PASSWORD,
      role: "player",
      status: "active",
    });

    const deleted = await service.deleteUser(created.id, adminUserId);
    assert.equal(deleted, true);

    const missing = await auth.findUserById(created.id);
    assert.equal(missing, null);
    await db.$disconnect();
  });

  it("refuses to let a user delete themselves", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createUserService(db);
    const auth = createAuthService(db);

    const created = await auth.createUser({
      displayName: "Self Delete",
      email: "self-delete@uwe.local",
      password: TEST_PASSWORD,
      role: "player",
      status: "active",
    });

    await assert.rejects(
      () => service.deleteUser(created.id, created.id),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "CANNOT_DELETE_SELF");
        return true;
      },
    );

    // Der Benutzer darf nach dem abgelehnten Selbst-Löschen weiter existieren.
    const stillThere = await auth.findUserById(created.id);
    assert.equal(stillThere?.id, created.id);
    await db.$disconnect();
  });

  it("refuses to delete the sole remaining active owner", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createUserService(db);
    const auth = createAuthService(db);

    const owner = await auth.createUser({
      displayName: "Sole Owner",
      email: "sole-owner@uwe.local",
      password: TEST_PASSWORD,
      role: "owner",
      status: "active",
    });

    // adminUserId ist Admin (kein Owner) und zählt daher nicht als aktiver Owner.
    await assert.rejects(
      () => service.deleteUser(owner.id, adminUserId),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "LAST_OWNER");
        return true;
      },
    );

    const stillThere = await auth.findUserById(owner.id);
    assert.equal(stillThere?.id, owner.id);
    await db.$disconnect();
  });

  it("hides worlds without membership from players", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createAuthService(db);

    const worlds = await service.listAccessibleWorldsForUser(playerUserId);
    const slugs = worlds.map((world) => world.slug);

    assert.ok(slugs.includes(worldASlug));
    assert.ok(!slugs.includes(worldBSlug));
    await db.$disconnect();
  });

  it("shows only permitted portal content for players with membership", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createAuthService(db);

    const ctx = await service.buildAccessContextForWorld(worldASlug, { userId: playerUserId });
    assert.ok(ctx);

    const pages = await service.listPagesForViewer(worldASlug, ctx);
    const slugs = pages.map((page) => page.slug);

    assert.ok(slugs.includes("player-lore"));
    assert.ok(slugs.includes("specific-secret"));
    await db.$disconnect();
  });

  it("blocks players from admin gate", () => {
    const denied = evaluateAdminGate({
      user: {
        id: playerUserId,
        displayName: "Mgmt Player",
        email: playerEmail,
        role: "player",
      },
    });
    assert.ok(denied);
    assert.equal(denied.status, 403);
  });

  it("redirects /worlds and /players to login when AUTH_REQUIRED is true", () => {
    const env = {
      ...process.env,
      NODE_ENV: "production",
      AUTH_REQUIRED: "true",
      PUBLIC_APP_URL: "https://uweanddragons.org",
    };

    for (const path of ["/worlds", "/players", "/worlds/user-mgmt-a"]) {
      const decision = evaluatePortalMiddleware(
        {
          pathname: path,
          url: `https://uweanddragons.org${path}`,
          headers: new Headers({ host: "uweanddragons.org" }),
          cookies: { get: () => undefined },
        },
        env,
      );
      assert.equal(decision.action, "redirect-login", path);
      assert.equal(decision.redirectPath, "/login");
    }
  });
});
