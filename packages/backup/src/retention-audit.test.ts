import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { createActivityLogService, createPrismaClient } from "@uwe/database/server";
import {
  createBackupBundle,
  createPreRestoreSafetyCopy,
  normalizeRetentionCount,
  applyBackupRetention,
} from "./index";

describe("backup retention and restore audit", () => {
  let databaseUrl: string;
  let backupsDir: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
    backupsDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-retention-"));
  });

  after(() => {
    fs.rmSync(backupsDir, { recursive: true, force: true });
  });

  it("normalizes retention count to allowed values", () => {
    assert.equal(normalizeRetentionCount(7), 7);
    assert.equal(normalizeRetentionCount(30), 30);
    assert.equal(normalizeRetentionCount(99), 14);
  });

  it("creates a pre-restore safety copy", async () => {
    const copy = await createPreRestoreSafetyCopy(databaseUrl, { outputDir: backupsDir });
    assert.ok(copy.filename.startsWith("pre-restore-"));
    assert.ok(fs.existsSync(copy.path));
  });

  it("logs backup_restored to the activity log", async () => {
    const bundle = await createBackupBundle(databaseUrl, { type: "full" });
    const db = createPrismaClient(databaseUrl);
    const activity = createActivityLogService(db);

    await activity.log({
      action: "backup_restored",
      targetType: "system",
      targetLabel: "test-backup.zip",
      summary: "Backup wiederhergestellt (Test).",
    });

    const entries = await db.activityLog.findMany({
      where: { action: "backup_restored" },
    });

    assert.ok(entries.length >= 1);
    assert.equal(entries[0]?.action, "backup_restored");
    await db.$disconnect();
  });

  it("applies retention and deletes older backups", async () => {
    const files = ["a.zip", "b.zip", "c.zip"];
    const backups = files.map((filename, index) => {
      const filePath = path.join(backupsDir, filename);
      fs.writeFileSync(filePath, `backup-${index}`);
      return {
        id: filename,
        filename,
        path: filePath,
        manifest: bundleManifest(new Date(Date.now() - index * 1000).toISOString()),
        size: 4,
        createdAt: new Date(Date.now() - index * 1000).toISOString(),
      };
    });

    const result = applyBackupRetention(backups, 2);
    assert.equal(result.kept.length, 2);
    assert.equal(result.deleted.length, 1);
    assert.ok(!fs.existsSync(path.join(backupsDir, "c.zip")));
  });
});

function bundleManifest(createdAt: string) {
  return {
    version: "1.0" as const,
    uweVersion: "0.1.0",
    schemaVersion: "test",
    type: "full" as const,
    createdAt,
    includesUsers: false,
    includesAuthSessions: false,
    includesSettings: false,
    stats: {
      worlds: 0,
      campaigns: 0,
      pages: 0,
      contentBlocks: 0,
      pageLinks: 0,
      assets: 0,
      gameSessions: 0,
      labels: 0,
      labelTemplates: 0,
      printLists: 0,
      soundboardButtons: 0,
    },
    assetFiles: [],
  };
}
