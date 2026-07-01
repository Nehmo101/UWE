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
