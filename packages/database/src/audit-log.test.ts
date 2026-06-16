import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildAccessContext, canViewAuditLog } from "@uwe/auth";
import { createAuthService } from "./auth";
import { createAuditLogService, logAuditEvent, redactAuditMetadata } from "./audit-log-service";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

describe("Audit log", () => {
  let databaseUrl: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
  });

  it("logs login_failed without storing passwords", async () => {
    const db = createPrismaClient(databaseUrl);
    const audit = createAuditLogService(db);

    await logAuditEvent(db, {
      action: "login_failed",
      targetType: "session",
      request: { ip: "203.0.113.10", userAgent: "TestBrowser/1.0" },
      metadata: {
        email: "player@example.com",
        password: "super-secret-password",
      },
    });

    const entries = await audit.list({ actions: ["login_failed"], limit: 5 });
    assert.equal(entries.length, 1);

    const entry = entries[0]!;
    assert.equal(entry.action, "login_failed");
    assert.ok(entry.ipHash);
    assert.ok(entry.userAgentHash);
    assert.notEqual(entry.ipHash, "203.0.113.10");

    const metadata = entry.metadataJson as Record<string, unknown>;
    assert.equal(metadata.email, "player@example.com");
    assert.equal(metadata.password, "[REDACTED]");

    await db.$disconnect();
  });

  it("logs visibility_changed for page updates", async () => {
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const audit = createAuditLogService(db);

    const world = await repo.createWorld({
      name: "Audit Visibility World",
      slug: "audit-visibility",
    });

    const page = await repo.createPage({
      worldId: world.id,
      title: "Hidden Lore",
      slug: "hidden-lore",
      type: "lore",
      visibility: "dm_only",
      publishStatus: "published",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "dm_only",
          content: "DM only content.",
        },
      ],
    });

    await logAuditEvent(db, {
      action: "visibility_changed",
      targetType: "page",
      targetId: page.id,
      worldId: world.id,
      metadata: {
        from: "dm_only",
        to: "player_visible",
        title: page.title,
      },
    });

    const entries = await audit.list({
      actions: ["visibility_changed"],
      worldId: world.id,
      limit: 5,
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.targetId, page.id);
    assert.equal((entries[0]!.metadataJson as { to: string }).to, "player_visible");

    await db.$disconnect();
  });

  it("logs secret_revealed without leaking secret values", async () => {
    const db = createPrismaClient(databaseUrl);
    const audit = createAuditLogService(db);

    await logAuditEvent(db, {
      action: "secret_revealed",
      targetType: "settings",
      targetId: "openai-api-key",
      metadata: {
        secretType: "api_key",
        apiKey: "sk-live-abcdefghijklmnopqrstuvwxyz",
        token: "bearer abc.def.ghi",
      },
    });

    const entries = await audit.list({ actions: ["secret_revealed"], limit: 5 });
    assert.equal(entries.length, 1);

    const serialized = JSON.stringify(entries[0]!.metadataJson);
    assert.equal(serialized.includes("sk-live"), false);
    assert.equal(serialized.includes("abc.def"), false);
    assert.match(serialized, /\[REDACTED\]/);

    await db.$disconnect();
  });

  it("redactAuditMetadata strips prompts and credentials", () => {
    const redacted = redactAuditMetadata({
      userPrompt: "Tell me the hidden GM note about the dragon",
      password: "hunter2",
      nested: {
        authorization: "Bearer secret-token-value",
        note: "safe metadata",
      },
      items: ["password=leak", "visible"],
    });

    assert.equal(redacted?.userPrompt, "[REDACTED]");
    assert.equal(redacted?.password, "[REDACTED]");
    assert.equal((redacted?.nested as { authorization: string }).authorization, "[REDACTED]");
    assert.equal((redacted?.nested as { note: string }).note, "safe metadata");
    assert.match(String((redacted?.items as string[])[0]), /\[REDACTED\]/);
    assert.equal((redacted?.items as string[])[1], "visible");
  });

  it("denies audit log access for PLAYER role", () => {
    const playerCtx = buildAccessContext({
      user: {
        id: "player-1",
        displayName: "Player",
        email: "player@example.com",
        role: "player",
      },
      worldMembership: {
        userId: "player-1",
        worldId: "world-1",
        role: "player",
        characterName: null,
      },
      guestModeEnabled: false,
    });

    const ownerCtx = buildAccessContext({
      user: {
        id: "owner-1",
        displayName: "Owner",
        email: "owner@example.com",
        role: "owner",
      },
      worldMembership: {
        userId: "owner-1",
        worldId: "world-1",
        role: "owner",
        characterName: null,
      },
      guestModeEnabled: false,
    });

    const dmCtx = buildAccessContext({
      user: {
        id: "dm-1",
        displayName: "DM",
        email: "dm@example.com",
        role: "dm",
      },
      worldMembership: {
        userId: "dm-1",
        worldId: "world-1",
        role: "dm",
        characterName: null,
      },
      guestModeEnabled: false,
    });

    assert.equal(canViewAuditLog(playerCtx), false);
    assert.equal(canViewAuditLog(ownerCtx), true);
    assert.equal(canViewAuditLog(dmCtx), true);
  });

  it("logs user_created via AuthService without password hash", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const audit = createAuditLogService(db);

    const user = await auth.createUser({
      displayName: "Audit Test User",
      email: "audit-user@example.com",
      password: "test-password-123",
      role: "player",
    });

    const entries = await audit.list({
      actions: ["user_created"],
      limit: 10,
    });

    const match = entries.find((entry) => entry.targetId === user.id);
    assert.ok(match);

    const serialized = JSON.stringify(match!.metadataJson);
    assert.equal(serialized.includes("test-password-123"), false);
    assert.equal(serialized.includes("passwordHash"), false);

    await db.$disconnect();
  });
});
