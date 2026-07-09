import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const databaseRoot = path.resolve(packageRoot, "..");
const migrationsDir = path.join(databaseRoot, "prisma", "migrations");

function listMigrationFiles(): Array<{ name: string; sqlPath: string }> {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      sqlPath: path.join(migrationsDir, entry.name, "migration.sql"),
    }))
    .filter((migration) => fs.existsSync(migration.sqlPath))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function execSqlite(dbPath: string, sql: string): void {
  const result = spawnSync("sqlite3", [dbPath], { input: sql, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `sqlite3 failed for ${dbPath}`);
  }
}

function createPrismaMigrationsTable(dbPath: string): void {
  execSqlite(
    dbPath,
    `
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );
  `,
  );
}

function applySqliteTestMigrations(dbPath: string): void {
  createPrismaMigrationsTable(dbPath);

  for (const migration of listMigrationFiles()) {
    const sql = fs.readFileSync(migration.sqlPath, "utf8");
    const now = new Date().toISOString();
    const checksum = createHash("sha256").update(sql).digest("hex");

    execSqlite(dbPath, sql);
    execSqlite(
      dbPath,
      `INSERT INTO "_prisma_migrations" (
        "id",
        "checksum",
        "finished_at",
        "migration_name",
        "logs",
        "rolled_back_at",
        "started_at",
        "applied_steps_count"
      ) VALUES (
        '${randomUUID()}',
        '${checksum}',
        '${now}',
        '${migration.name}',
        NULL,
        NULL,
        '${now}',
        1
      );`,
    );
  }
}

export function createTestDatabaseUrl(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-db-"));
  const dbPath = path.join(tempDir, "test.db");
  const databaseUrl = `file:${dbPath}`;

  applySqliteTestMigrations(dbPath);

  return databaseUrl;
}
