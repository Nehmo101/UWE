import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  resolveAllDataPaths,
  resolveBackupsDirFromEnv,
  resolveDataDir,
  resolveDatabaseFilePath,
  resolveExportsDirFromEnv,
  resolveUploadsDirFromEnv,
} from "./data-paths";

const ENV_KEYS = [
  "UWE_DATA_DIR",
  "UWE_UPLOADS_DIR",
  "UWE_UPLOADS_ROOT",
  "UPLOADS_DIR",
  "UWE_BACKUP_DIR",
  "BACKUPS_DIR",
  "UWE_EXPORT_DIR",
  "EXPORTS_DIR",
  "DATABASE_URL",
] as const;

function clearEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe("data path resolution", () => {
  afterEach(() => {
    clearEnv();
  });

  it("uses defaults relative to cwd when no env is set", () => {
    const cwd = path.resolve("/tmp/uwe-test");
    assert.equal(resolveDataDir(cwd), path.join(cwd, "data"));
    assert.equal(resolveUploadsDirFromEnv(cwd), path.join(cwd, "data", "uploads"));
    assert.equal(resolveBackupsDirFromEnv(cwd), path.join(cwd, "data", "backups"));
    assert.equal(resolveExportsDirFromEnv(cwd), path.join(cwd, "exports"));
  });

  it("derives child paths from UWE_DATA_DIR when individual paths are unset", () => {
    process.env.UWE_DATA_DIR = "C:\\UWE\\data";

    assert.equal(resolveDataDir(), path.resolve("C:\\UWE\\data"));
    assert.equal(resolveUploadsDirFromEnv(), path.join(path.resolve("C:\\UWE\\data"), "uploads"));
    assert.equal(resolveBackupsDirFromEnv(), path.join(path.resolve("C:\\UWE\\data"), "backups"));
  });

  it("prefers explicit UWE_* path env vars over UWE_DATA_DIR defaults", () => {
    const base = path.resolve("C:", "uwe-prod-test");
    process.env.UWE_DATA_DIR = path.join(base, "data");
    process.env.UWE_UPLOADS_DIR = path.join(base, "media", "uploads");
    process.env.UWE_BACKUP_DIR = path.join(base, "backups");
    process.env.UWE_EXPORT_DIR = path.join(base, "exports");

    const paths = resolveAllDataPaths(base);
    assert.equal(paths.uploadsDir, path.resolve(base, "media", "uploads"));
    assert.equal(paths.backupsDir, path.resolve(base, "backups"));
    assert.equal(paths.exportsDir, path.resolve(base, "exports"));
  });

  it("keeps legacy UPLOADS_DIR / BACKUPS_DIR / EXPORTS_DIR working", () => {
    process.env.UPLOADS_DIR = "./legacy/uploads";
    process.env.BACKUPS_DIR = "./legacy/backups";
    process.env.EXPORTS_DIR = "./legacy/exports";

    const base = path.resolve("/repo");
    assert.equal(resolveUploadsDirFromEnv(base), path.resolve(base, "legacy/uploads"));
    assert.equal(resolveBackupsDirFromEnv(base), path.resolve(base, "legacy/backups"));
    assert.equal(resolveExportsDirFromEnv(base), path.resolve(base, "legacy/exports"));
  });

  it("resolves relative DATABASE_URL file paths against baseDir", () => {
    process.env.DATABASE_URL = "file:./data/uwe.db";
    assert.equal(resolveDatabaseFilePath("/repo"), path.resolve("/repo", "data/uwe.db"));
  });

  it("returns null for non-file DATABASE_URL values", () => {
    process.env.DATABASE_URL = "libsql://example.com";
    assert.equal(resolveDatabaseFilePath(), null);
  });
});
