import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createAuthService } from "./auth";
import { createAuditLogService } from "./audit-log-service";
import { createActivityLogService } from "./activity-log-service";
import { createUweRepository } from "./repository";
import { countUnifiedActivity, listUnifiedActivity } from "./unified-activity-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("unified activity service", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("merges activity and audit entries by timestamp", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      email: "owner-cockpit@test.local",
      displayName: "Owner Cockpit",
      password: "test-pass-123",
      role: "owner",
    });

    const activity = createActivityLogService(db);
    await activity.log({
      action: "content_created",
      targetType: "page",
      summary: "Seite erstellt",
      worldSlug: "terra",
    });

    const audit = createAuditLogService(db);
    await audit.log({
      actorUserId: owner.id,
      action: "login_success",
      targetType: "session",
      metadata: { surface: "studio" },
    });

    const { entries, total } = await listUnifiedActivity(db, { limit: 10 });
    assert.ok(entries.length >= 2);
    assert.ok(total >= 2);
    assert.ok(entries.some((entry) => entry.source === "activity"));
    assert.ok(entries.some((entry) => entry.source === "audit"));
    assert.ok(entries[0]!.timestamp >= entries[1]!.timestamp);

    await db.$disconnect();
  });

  it("filters by world slug and reports accurate totals", async () => {
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const activity = createActivityLogService(db);

    const world = await repo.createWorld({
      name: "Unified Filter World",
      slug: `unified-filter-${Date.now()}`,
    });

    await activity.log({
      worldId: world.id,
      worldSlug: world.slug,
      action: "content_updated",
      targetType: "page",
      summary: "Welt-spezifische Änderung",
    });

    await activity.log({
      action: "export_executed",
      targetType: "world",
      summary: "Globaler Export",
    });

    const filtered = await listUnifiedActivity(db, {
      worldSlug: world.slug,
      limit: 20,
    });
    assert.ok(filtered.entries.every((entry) => entry.worldSlug === world.slug));
    assert.ok(filtered.total >= 1);

    const count = await countUnifiedActivity(db, { worldSlug: world.slug });
    assert.ok(count >= 1);

    await db.$disconnect();
  });

  it("includes actor display names on audit entries", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const user = await auth.createUser({
      email: `audit-actor-${Date.now()}@test.local`,
      displayName: "Audit Actor",
      password: "test-pass-123",
      role: "admin",
    });

    const audit = createAuditLogService(db);
    await audit.log({
      actorUserId: user.id,
      action: "logout",
      targetType: "session",
    });

    const { entries } = await listUnifiedActivity(db, { source: "audit", limit: 5 });
    const match = entries.find((entry) => entry.actorUserId === user.id);
    assert.ok(match);
    assert.equal(match!.actorDisplayName, "Audit Actor");

    await db.$disconnect();
  });
});
