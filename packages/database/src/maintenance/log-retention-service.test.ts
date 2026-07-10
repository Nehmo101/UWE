import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "../client";
import { createTestDatabaseUrl } from "../test-helpers";
import { pruneRetentionLogs } from "./log-retention-service";

const OLD = new Date("2020-01-01T00:00:00.000Z");
const RECENT = new Date();

async function seedAuditLogs(db: PrismaClient): Promise<void> {
  await db.auditLog.create({
    data: { action: "login_failed", targetType: "session", timestamp: OLD },
  });
  await db.auditLog.create({
    data: { action: "login_failed", targetType: "session", timestamp: RECENT },
  });
}

async function seedActivityLogs(db: PrismaClient): Promise<void> {
  await db.activityLog.create({
    data: { action: "content_created", targetType: "page", summary: "old", createdAt: OLD },
  });
  await db.activityLog.create({
    data: { action: "content_created", targetType: "page", summary: "fresh", createdAt: RECENT },
  });
}

async function seedPageVersions(db: PrismaClient, versions: number): Promise<string> {
  const world = await db.world.create({ data: { name: "Retention", slug: "retention-world" } });
  const page = await db.page.create({
    data: { worldId: world.id, title: "Versioned", slug: "versioned", type: "location" },
  });
  for (let version = 1; version <= versions; version += 1) {
    await db.pageVersion.create({
      data: { pageId: page.id, version, snapshot: { title: `v${version}` } },
    });
  }
  return page.id;
}

describe("log-retention-service", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  it("deletes nothing when disabled (no-op)", async () => {
    const db = createPrismaClient(databaseUrl);
    await seedAuditLogs(db);

    const before = await db.auditLog.count();
    const summary = await pruneRetentionLogs(db, { enabled: false, retentionDays: 30 });

    assert.equal(summary.mode, "disabled");
    assert.equal(summary.totalDeleted, 0);
    assert.equal(summary.tables.length, 0);
    assert.equal(await db.auditLog.count(), before);

    await db.$disconnect();
  });

  it("reports would-delete in dry-run without deleting", async () => {
    const db = createPrismaClient(databaseUrl);
    const before = await db.auditLog.count();

    const summary = await pruneRetentionLogs(db, { dryRun: true, retentionDays: 30 });

    assert.equal(summary.mode, "dry-run");
    assert.equal(summary.totalDeleted, 0);
    const audit = summary.tables.find((entry) => entry.table === "audit_logs");
    assert.ok(audit);
    assert.ok(audit.wouldDelete >= 1, "expected the old audit row to be reported");
    assert.equal(audit.deleted, 0);
    // Nothing was actually removed.
    assert.equal(await db.auditLog.count(), before);

    await db.$disconnect();
  });

  it("deletes old rows and keeps recent rows when enabled", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    await seedAuditLogs(db);
    await seedActivityLogs(db);

    const summary = await pruneRetentionLogs(db, { enabled: true, retentionDays: 30 });

    assert.equal(summary.mode, "delete");
    assert.equal(summary.errors.length, 0, JSON.stringify(summary.errors));
    assert.ok(summary.totalDeleted >= 2);

    // Old rows gone, recent rows kept — confirms audit uses `timestamp`, activity uses `createdAt`.
    assert.equal(await db.auditLog.count(), 1);
    assert.equal(await db.auditLog.count({ where: { timestamp: OLD } }), 0);
    assert.equal(await db.activityLog.count(), 1);
    assert.equal(await db.activityLog.count({ where: { summary: "fresh" } }), 1);

    await db.$disconnect();
  });

  it("keeps only the N most-recent versions per parent", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    const pageId = await seedPageVersions(db, 5);

    const summary = await pruneRetentionLogs(db, { enabled: true, keepVersions: 2 });

    const versions = summary.tables.find((entry) => entry.table === "page_versions");
    assert.ok(versions);
    assert.equal(versions.deleted, 3);

    const remaining = await db.pageVersion.findMany({
      where: { pageId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    assert.deepEqual(
      remaining.map((entry) => entry.version),
      [5, 4],
    );

    await db.$disconnect();
  });
});
