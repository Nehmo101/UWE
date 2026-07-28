import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import {
  getBackupFreshnessStatus,
  getProductionSafetyWarnings,
  isRunDbSeedUnsafe,
  isWeakAuthSecret,
} from "./production-safety";
import { createTestDatabaseUrl } from "./test-helpers";

describe("production safety helpers", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("detects weak auth secrets", () => {
    assert.equal(isWeakAuthSecret(undefined), true);
    assert.equal(isWeakAuthSecret("change-me"), true);
    assert.equal(isWeakAuthSecret("generate-a-random-secret-for-production"), true);
    assert.equal(isWeakAuthSecret("x".repeat(32)), false);
  });

  it("flags unsafe RUN_DB_SEED values", () => {
    const previous = process.env.RUN_DB_SEED;
    try {
      process.env.RUN_DB_SEED = "false";
      assert.equal(isRunDbSeedUnsafe(), false);

      process.env.RUN_DB_SEED = "auto";
      assert.equal(isRunDbSeedUnsafe(), true);
    } finally {
      if (previous === undefined) {
        delete process.env.RUN_DB_SEED;
      } else {
        process.env.RUN_DB_SEED = previous;
      }
    }
  });

  it("detects missing and stale backup files", () => {
    const backupsDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-backups-"));
    try {
      const emptyStatus = getBackupFreshnessStatus(backupsDir);
      assert.equal(emptyStatus.readable, true);
      assert.equal(emptyStatus.backupCount, 0);

      const oldBackupPath = path.join(backupsDir, "uwe-backup-full-old.zip");
      fs.writeFileSync(oldBackupPath, "test-backup");
      const oldDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 8);
      fs.utimesSync(oldBackupPath, oldDate, oldDate);

      const staleStatus = getBackupFreshnessStatus(backupsDir);
      assert.equal(staleStatus.backupCount, 1);
      assert.equal(staleStatus.latestBackupFilename, "uwe-backup-full-old.zip");
      assert.ok(staleStatus.latestBackupAt);
      assert.ok(Date.now() - staleStatus.latestBackupAt.getTime() > 1000 * 60 * 60 * 24 * 7);
    } finally {
      fs.rmSync(backupsDir, { recursive: true, force: true });
    }
  });

  it("builds production warnings without leaking secret values", async () => {
    const previousAuth = process.env.AUTH_SECRET;
    const previousSeed = process.env.RUN_DB_SEED;
    const previousToken = process.env.STUDIO_API_TOKEN;
    const previousPublicUrl = process.env.PUBLIC_APP_URL;
    const previousBackupDir = process.env.BACKUPS_DIR;
    const backupsDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-prod-warnings-"));

    process.env.AUTH_SECRET = "change-me";
    delete process.env.STUDIO_API_TOKEN;
    process.env.RUN_DB_SEED = "auto";
    process.env.PUBLIC_APP_URL = "https://uwe.example";
    process.env.BACKUPS_DIR = backupsDir;

    try {
      const warnings = await getProductionSafetyWarnings(createPrismaClient(databaseUrl));
      const serialized = JSON.stringify(warnings);

      assert.ok(warnings.some((warning) => warning.id === "production:auth-secret"));
      assert.ok(warnings.some((warning) => warning.id === "production:run-db-seed"));
      assert.ok(warnings.some((warning) => warning.id === "production:studio-api-token"));
      assert.ok(warnings.some((warning) => warning.id === "production:studio-exposure"));
      assert.ok(warnings.some((warning) => warning.id === "production:cloudflare-tunnel-scope"));
      assert.ok(warnings.some((warning) => warning.id === "production:backup-missing"));
      assert.equal(
        warnings.find((warning) => warning.id === "production:studio-api-token")?.severity,
        "critical",
      );
      assert.ok(!serialized.includes("change-me"));
    } finally {
      if (previousAuth === undefined) {
        delete process.env.AUTH_SECRET;
      } else {
        process.env.AUTH_SECRET = previousAuth;
      }
      if (previousSeed === undefined) {
        delete process.env.RUN_DB_SEED;
      } else {
        process.env.RUN_DB_SEED = previousSeed;
      }
      if (previousToken === undefined) {
        delete process.env.STUDIO_API_TOKEN;
      } else {
        process.env.STUDIO_API_TOKEN = previousToken;
      }
      if (previousPublicUrl === undefined) {
        delete process.env.PUBLIC_APP_URL;
      } else {
        process.env.PUBLIC_APP_URL = previousPublicUrl;
      }
      if (previousBackupDir === undefined) {
        delete process.env.BACKUPS_DIR;
      } else {
        process.env.BACKUPS_DIR = previousBackupDir;
      }
      fs.rmSync(backupsDir, { recursive: true, force: true });
    }
  });
});
