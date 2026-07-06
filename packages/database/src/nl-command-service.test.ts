import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createAuditLogService } from "./audit-log-service";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import {
  buildConfirmationMessage,
  createNlCommandService,
  isMutationIntent,
  issueConfirmationToken,
  parseCommandIntent,
  verifyConfirmationToken,
} from "./nl-command-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("NlCommandService", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  it("rejects unknown commands", () => {
    const result = parseCommandIntent("delete all users now");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unknown_command");
    }
  });

  it("rejects empty input", () => {
    const result = parseCommandIntent("   ");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid");
    }
  });

  it("parses list users intent", () => {
    const result = parseCommandIntent("Zeige alle Benutzer");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.intent, "list_users");
      assert.equal(result.requiresConfirmation, false);
    }
  });

  it("parses list worlds intent", () => {
    const result = parseCommandIntent("list worlds");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.intent, "list_worlds");
    }
  });

  it("parses migration status intent", () => {
    const result = parseCommandIntent("migration status");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.intent, "get_migration_status");
    }
  });

  it("parses pending migrations intent", () => {
    const result = parseCommandIntent("pending migrations");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.intent, "list_pending_migrations");
      assert.equal(result.requiresConfirmation, false);
    }
  });

  it("parses list open bugs intent", () => {
    const result = parseCommandIntent("list open bugs");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.intent, "list_open_bugs");
    }
  });

  it("parses secrets status intent", () => {
    const result = parseCommandIntent("secrets status");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent.intent, "get_secrets_status");
    }
  });

  it("parses lock portal and studio intents", () => {
    const portal = parseCommandIntent("lock portal");
    assert.equal(portal.ok, true);
    if (portal.ok && portal.intent.intent === "set_lock_portal") {
      assert.equal(portal.intent.enabled, true);
      assert.equal(portal.requiresConfirmation, true);
    }

    const studio = parseCommandIntent("unlock studio");
    assert.equal(studio.ok, true);
    if (studio.ok && studio.intent.intent === "set_lock_studio") {
      assert.equal(studio.intent.enabled, false);
    }
  });

  it("parses user management intents", () => {
    const assign = parseCommandIntent("Mach Carina zur Spielerin in Terra");
    assert.equal(assign.ok, true);
    if (assign.ok && assign.intent.intent === "assign_world_role") {
      assert.equal(assign.intent.userQuery.toLowerCase(), "carina");
      assert.equal(assign.intent.worldQuery.toLowerCase(), "terra");
      assert.equal(assign.intent.role, "player");
      assert.equal(assign.requiresConfirmation, true);
    }

    const invite = parseCommandIntent("invite player@example.com as player in terra");
    assert.equal(invite.ok, true);
    if (invite.ok && invite.intent.intent === "invite_user") {
      assert.equal(invite.intent.email, "player@example.com");
      assert.equal(invite.intent.role, "player");
      assert.equal(invite.intent.worldQuery, "terra");
    }

    const disable = parseCommandIntent("disable user carina");
    assert.equal(disable.ok, true);
    if (disable.ok) {
      assert.equal(disable.intent.intent, "disable_user");
    }

    const members = parseCommandIntent("zeige mitglieder in terra");
    assert.equal(members.ok, true);
    if (members.ok && members.intent.intent === "list_world_members") {
      assert.equal(members.intent.worldQuery, "terra");
      assert.equal(members.requiresConfirmation, false);
    }

    const deleteUser = parseCommandIntent("delete user testplayer");
    assert.equal(deleteUser.ok, true);
    if (deleteUser.ok) {
      assert.equal(deleteUser.intent.intent, "delete_user");
      assert.equal(deleteUser.requiresConfirmation, true);
    }

    const resetPassword = parseCommandIntent("reset password for carina");
    assert.equal(resetPassword.ok, true);
    if (resetPassword.ok) {
      assert.equal(resetPassword.intent.intent, "reset_password");
      assert.equal(resetPassword.requiresConfirmation, true);
    }
  });

  it("parses maintenance enable/disable intents", () => {
    const enable = parseCommandIntent("Wartungsmodus aktivieren");
    assert.equal(enable.ok, true);
    if (enable.ok) {
      assert.equal(enable.intent.intent, "set_maintenance_mode");
      assert.equal(enable.intent.enabled, true);
      assert.equal(enable.requiresConfirmation, true);
    }

    const disable = parseCommandIntent("disable maintenance mode");
    assert.equal(disable.ok, true);
    if (disable.ok && disable.intent.intent === "set_maintenance_mode") {
      assert.equal(disable.intent.enabled, false);
    }
  });

  it("builds human-readable confirmation messages", () => {
    const message = buildConfirmationMessage({
      intent: "set_maintenance_mode",
      enabled: true,
      message: "Kurze Wartung",
    });
    assert.match(message, /Wartungsmodus aktivieren/);
    assert.match(message, /Kurze Wartung/);
  });

  it("requires confirmation token for mutations", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "NL Owner",
      email: "nl-owner@example.com",
      password: "test-password-123",
      role: "owner",
    });

    const service = createNlCommandService(db);
    const intent = { intent: "set_maintenance_mode" as const, enabled: true };

    const blocked = await service.execute(intent, { actorUserId: owner.id });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.code, "confirmation_required");
    }

    await db.$disconnect();
  });

  it("executes read-only intents without confirmation token", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "NL Reader",
      email: "nl-reader@example.com",
      password: "test-password-123",
      role: "owner",
    });

    const service = createNlCommandService(db);
    const result = await service.execute({ intent: "list_users" }, { actorUserId: owner.id });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.intent, "list_users");
      assert.ok(Array.isArray(result.data));
    }

    const audit = createAuditLogService(db);
    const entries = await audit.list({ limit: 20 });
    const nlEntry = entries.find((entry) => {
      const metadata = entry.metadataJson as Record<string, unknown> | null;
      return metadata?.source === "nl_command" && metadata.intent === "list_users";
    });
    assert.ok(nlEntry);

    await db.$disconnect();
  });

  it("executes maintenance mutation with valid confirmation token", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "NL Mutator",
      email: "nl-mutator@example.com",
      password: "test-password-123",
      role: "owner",
    });

    const intent = { intent: "set_maintenance_mode" as const, enabled: true };
    assert.equal(isMutationIntent(intent), true);

    const issuedAt = Date.now();
    const token = issueConfirmationToken(intent, owner.id, issuedAt);
    assert.equal(verifyConfirmationToken(intent, owner.id, token, issuedAt), true);

    const service = createNlCommandService(db);
    const result = await service.execute(intent, { actorUserId: owner.id }, {
      confirmationToken: token,
      confirmationIssuedAt: issuedAt,
    });
    assert.equal(result.ok, true);

    await db.$disconnect();
  });

  it("executes read-only status intents without confirmation token", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "NL Status",
      email: "nl-status@example.com",
      password: "test-password-123",
      role: "owner",
    });

    const service = createNlCommandService(db);

    const secrets = await service.execute(
      { intent: "get_secrets_status" },
      { actorUserId: owner.id },
    );
    assert.equal(secrets.ok, true);
    if (secrets.ok) {
      assert.equal(secrets.intent, "get_secrets_status");
      assert.ok(secrets.data && typeof secrets.data === "object");
    }

    const pending = await service.execute(
      { intent: "list_pending_migrations" },
      { actorUserId: owner.id },
    );
    assert.equal(pending.ok, true);
    if (pending.ok) {
      assert.equal(pending.intent, "list_pending_migrations");
      assert.ok(pending.data && typeof pending.data === "object");
    }

    const bugs = await service.execute({ intent: "list_open_bugs" }, { actorUserId: owner.id });
    assert.equal(bugs.ok, true);
    if (bugs.ok) {
      assert.equal(bugs.intent, "list_open_bugs");
      assert.ok(Array.isArray(bugs.data));
    }

    await db.$disconnect();
  });

  it("executes lock portal mutation with valid confirmation token", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "NL Portal Lock",
      email: "nl-portal-lock@example.com",
      password: "test-password-123",
      role: "owner",
    });

    const intent = { intent: "set_lock_portal" as const, enabled: true };
    const issuedAt = Date.now();
    const token = issueConfirmationToken(intent, owner.id, issuedAt);

    const service = createNlCommandService(db);
    const result = await service.execute(intent, { actorUserId: owner.id }, {
      confirmationToken: token,
      confirmationIssuedAt: issuedAt,
    });
    assert.equal(result.ok, true);

    await db.$disconnect();
  });

  it("assigns world role with confirmation", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "NL Assign Owner",
      email: "nl-assign-owner@example.com",
      password: "test-password-123",
      role: "owner",
    });
    const player = await auth.createUser({
      displayName: "NL Assign Player",
      email: "nl-assign-player@example.com",
      password: "test-password-123",
      role: "player",
    });

    const world = await db.world.create({
      data: {
        name: "NL Assign World",
        slug: "nl-assign-world",
      },
    });

    const intent = {
      intent: "assign_world_role" as const,
      userQuery: "NL Assign Player",
      worldQuery: "nl-assign-world",
      role: "player" as const,
    };
    const issuedAt = Date.now();
    const token = issueConfirmationToken(intent, owner.id, issuedAt);

    const service = createNlCommandService(db);
    const result = await service.execute(intent, { actorUserId: owner.id }, {
      confirmationToken: token,
      confirmationIssuedAt: issuedAt,
    });
    assert.equal(result.ok, true);

    const membership = await db.worldMembership.findUnique({
      where: { userId_worldId: { userId: player.id, worldId: world.id } },
    });
    assert.ok(membership);
    assert.equal(membership.role, "player");

    await db.$disconnect();
  });

  it("parses create world intents in German and English", () => {
    const de = parseCommandIntent("Erstelle eine neue Welt Aventurien");
    assert.equal(de.ok, true);
    if (de.ok) {
      assert.equal(de.intent.intent, "create_world");
      if (de.intent.intent === "create_world") {
        assert.equal(de.intent.name, "Aventurien");
      }
      assert.equal(de.requiresConfirmation, true);
    }

    const en = parseCommandIntent("create world aventurien");
    assert.equal(en.ok, true);
    if (en.ok && en.intent.intent === "create_world") {
      assert.equal(en.intent.name, "aventurien");
    }

    const quotedUpper = parseCommandIntent("CREATE WORLD 'Lost Isles'");
    assert.equal(quotedUpper.ok, true);
    if (quotedUpper.ok && quotedUpper.intent.intent === "create_world") {
      assert.equal(quotedUpper.intent.name, "Lost Isles");
    }

    const anlegen = parseCommandIntent("Lege eine Welt Mittelerde an");
    assert.equal(anlegen.ok, true);
    if (anlegen.ok && anlegen.intent.intent === "create_world") {
      assert.equal(anlegen.intent.name, "Mittelerde");
    }
  });

  it("parses global role change intents in German and English", () => {
    const de = parseCommandIntent("Mach Carina zum Admin");
    assert.equal(de.ok, true);
    if (de.ok) {
      assert.equal(de.intent.intent, "set_user_role");
      if (de.intent.intent === "set_user_role") {
        assert.equal(de.intent.userQuery.toLowerCase(), "carina");
        assert.equal(de.intent.role, "admin");
      }
      assert.equal(de.requiresConfirmation, true);
    }

    const en = parseCommandIntent("make carina admin");
    assert.equal(en.ok, true);
    if (en.ok && en.intent.intent === "set_user_role") {
      assert.equal(en.intent.role, "admin");
    }

    const globalRole = parseCommandIntent("Setze die globale Rolle von Carina auf DM");
    assert.equal(globalRole.ok, true);
    if (globalRole.ok) {
      assert.equal(globalRole.intent.intent, "set_user_role");
      if (globalRole.intent.intent === "set_user_role") {
        assert.equal(globalRole.intent.userQuery.toLowerCase(), "carina");
        assert.equal(globalRole.intent.role, "dm");
      }
    }
  });

  it("keeps world-scoped role commands separate from global role changes", () => {
    const worldScoped = parseCommandIntent("Mach Carina zur Spielerin in Terra");
    assert.equal(worldScoped.ok, true);
    if (worldScoped.ok) {
      assert.equal(worldScoped.intent.intent, "assign_world_role");
    }

    const globalScoped = parseCommandIntent("Mach Carina zur Spielerin");
    assert.equal(globalScoped.ok, true);
    if (globalScoped.ok) {
      assert.equal(globalScoped.intent.intent, "set_user_role");
    }
  });

  it("rejects global role commands with unknown roles", () => {
    const result = parseCommandIntent("Mach Carina zum Superhelden");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unknown_command");
    }
  });

  it("requires confirmation for create world and set user role mutations", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "NL Confirm Guard",
      email: "nl-confirm-guard@example.com",
      password: "test-password-123",
      role: "owner",
    });

    const service = createNlCommandService(db);

    const createWorld = await service.execute(
      { intent: "create_world", name: "NL Unconfirmed World" },
      { actorUserId: owner.id },
    );
    assert.equal(createWorld.ok, false);
    if (!createWorld.ok) {
      assert.equal(createWorld.code, "confirmation_required");
    }

    const setRole = await service.execute(
      { intent: "set_user_role", userQuery: "carina", role: "admin" },
      { actorUserId: owner.id },
    );
    assert.equal(setRole.ok, false);
    if (!setRole.ok) {
      assert.equal(setRole.code, "confirmation_required");
    }

    await db.$disconnect();
  });

  it("creates a world with confirmation, owner membership, and audit entry", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "NL World Creator",
      email: "nl-world-creator@example.com",
      password: "test-password-123",
      role: "owner",
    });

    const intent = { intent: "create_world" as const, name: "NL Created World" };
    assert.equal(isMutationIntent(intent), true);

    const issuedAt = Date.now();
    const token = issueConfirmationToken(intent, owner.id, issuedAt);

    const service = createNlCommandService(db);
    const result = await service.execute(intent, { actorUserId: owner.id }, {
      confirmationToken: token,
      confirmationIssuedAt: issuedAt,
    });
    assert.equal(result.ok, true);

    const world = await db.world.findUnique({ where: { slug: "nl-created-world" } });
    assert.ok(world);
    assert.equal(world.name, "NL Created World");

    const membership = await db.worldMembership.findUnique({
      where: { userId_worldId: { userId: owner.id, worldId: world.id } },
    });
    assert.ok(membership);
    assert.equal(membership.role, "owner");

    const audit = createAuditLogService(db);
    const entries = await audit.list({ limit: 30 });
    const nlEntry = entries.find((entry) => {
      const metadata = entry.metadataJson as Record<string, unknown> | null;
      return metadata?.source === "nl_command" && metadata.intent === "create_world";
    });
    assert.ok(nlEntry);
    assert.equal(nlEntry.targetType, "world");
    assert.equal(nlEntry.targetId, world.id);

    await db.$disconnect();
  });

  it("rejects creating a world whose name already exists", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "NL World Dup Creator",
      email: "nl-world-dup-creator@example.com",
      password: "test-password-123",
      role: "owner",
    });

    await db.world.create({
      data: { name: "NL Duplicate World", slug: "nl-duplicate-world" },
    });

    const intent = { intent: "create_world" as const, name: "NL Duplicate World" };
    const issuedAt = Date.now();
    const token = issueConfirmationToken(intent, owner.id, issuedAt);

    const service = createNlCommandService(db);
    const result = await service.execute(intent, { actorUserId: owner.id }, {
      confirmationToken: token,
      confirmationIssuedAt: issuedAt,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid");
      assert.match(result.error, /existiert bereits/);
    }

    await db.$disconnect();
  });

  it("sets a global user role with confirmation and audit entry", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "NL Role Admin",
      email: "nl-role-admin@example.com",
      password: "test-password-123",
      role: "owner",
    });
    const target = await auth.createUser({
      displayName: "NL Role Target",
      email: "nl-role-target@example.com",
      password: "test-password-123",
      role: "player",
    });

    const intent = {
      intent: "set_user_role" as const,
      userQuery: "NL Role Target",
      role: "dm" as const,
    };
    const issuedAt = Date.now();
    const token = issueConfirmationToken(intent, owner.id, issuedAt);

    const service = createNlCommandService(db);
    const result = await service.execute(intent, { actorUserId: owner.id }, {
      confirmationToken: token,
      confirmationIssuedAt: issuedAt,
    });
    assert.equal(result.ok, true);

    const updated = await db.user.findUnique({ where: { id: target.id } });
    assert.equal(updated?.role, "dm");

    const audit = createAuditLogService(db);
    const entries = await audit.list({ limit: 30 });
    const nlEntry = entries.find((entry) => {
      const metadata = entry.metadataJson as Record<string, unknown> | null;
      return metadata?.source === "nl_command" && metadata.intent === "set_user_role";
    });
    assert.ok(nlEntry);
    assert.equal(nlEntry.targetType, "user");
    assert.equal(nlEntry.targetId, target.id);

    await db.$disconnect();
  });

  it("blocks changing your own global role", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "NL Self Degrade",
      email: "nl-self-degrade@example.com",
      password: "test-password-123",
      role: "owner",
    });

    const intent = {
      intent: "set_user_role" as const,
      userQuery: "NL Self Degrade",
      role: "player" as const,
    };
    const issuedAt = Date.now();
    const token = issueConfirmationToken(intent, owner.id, issuedAt);

    const service = createNlCommandService(db);
    const result = await service.execute(intent, { actorUserId: owner.id }, {
      confirmationToken: token,
      confirmationIssuedAt: issuedAt,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "forbidden");
    }

    await db.$disconnect();
  });

  it("blocks demoting an owner via NL command", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const actor = await auth.createUser({
      displayName: "NL Owner Actor",
      email: "nl-owner-actor@example.com",
      password: "test-password-123",
      role: "owner",
    });
    await auth.createUser({
      displayName: "NL Owner Victim",
      email: "nl-owner-victim@example.com",
      password: "test-password-123",
      role: "owner",
    });

    const intent = {
      intent: "set_user_role" as const,
      userQuery: "NL Owner Victim",
      role: "player" as const,
    };
    const issuedAt = Date.now();
    const token = issueConfirmationToken(intent, actor.id, issuedAt);

    const service = createNlCommandService(db);
    const result = await service.execute(intent, { actorUserId: actor.id }, {
      confirmationToken: token,
      confirmationIssuedAt: issuedAt,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "forbidden");
    }

    await db.$disconnect();
  });

  it("blocks promoting to owner via NL command", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const actor = await auth.createUser({
      displayName: "NL Promote Actor",
      email: "nl-promote-actor@example.com",
      password: "test-password-123",
      role: "owner",
    });
    await auth.createUser({
      displayName: "NL Promote Target",
      email: "nl-promote-target@example.com",
      password: "test-password-123",
      role: "player",
    });

    const intent = {
      intent: "set_user_role" as const,
      userQuery: "NL Promote Target",
      role: "owner" as const,
    };
    const issuedAt = Date.now();
    const token = issueConfirmationToken(intent, actor.id, issuedAt);

    const service = createNlCommandService(db);
    const result = await service.execute(intent, { actorUserId: actor.id }, {
      confirmationToken: token,
      confirmationIssuedAt: issuedAt,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "forbidden");
      assert.match(result.error, /owner/i);
    }

    await db.$disconnect();
  });

  it("rejects forged confirmation tokens", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "NL Guard",
      email: "nl-guard@example.com",
      password: "test-password-123",
      role: "owner",
    });

    const intent = { intent: "set_maintenance_mode" as const, enabled: false };
    const service = createNlCommandService(db);
    const result = await service.execute(intent, { actorUserId: owner.id }, {
      confirmationToken: "not-a-valid-token",
      confirmationIssuedAt: Date.now(),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "confirmation_invalid");
    }

    await db.$disconnect();
  });
});
