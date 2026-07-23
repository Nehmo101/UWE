import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBrainPrismaClient, type BrainPrismaClient } from "./brain-client";

export type { BrainPrismaClient };

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const databaseRoot = path.resolve(packageRoot, "..");
const migrationsDir = path.join(databaseRoot, "prisma", "migrations");
const brainMigrationsDir = path.join(databaseRoot, "prisma", "brain", "migrations");

function listMigrationFiles(dir: string): Array<{ name: string; sqlPath: string }> {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      sqlPath: path.join(dir, entry.name, "migration.sql"),
    }))
    .filter((migration) => fs.existsSync(migration.sqlPath))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Uses Node's built-in SQLite (node:sqlite, Node 22+) rather than shelling out
// to a `sqlite3` CLI binary, so tests run anywhere Node does — no external tool
// on PATH — and get FTS5 support (the brain 0000_init migration needs it).
function execSqlite(dbPath: string, sql: string): void {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(sql);
  } finally {
    db.close();
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

function recordMigration(dbPath: string, name: string, sql: string): void {
  const now = new Date().toISOString();
  const checksum = createHash("sha256").update(sql).digest("hex");

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
        '${name}',
        NULL,
        NULL,
        '${now}',
        1
      );`,
  );
}

function applySqliteTestMigrations(dbPath: string): void {
  createPrismaMigrationsTable(dbPath);

  for (const migration of listMigrationFiles(migrationsDir)) {
    const sql = fs.readFileSync(migration.sqlPath, "utf8");
    execSqlite(dbPath, sql);
    recordMigration(dbPath, migration.name, sql);
  }
}

/**
 * Brain database counterpart of {@link applySqliteTestMigrations}. Applies the
 * migrations under `prisma/brain/migrations/*` so tests get an isolated Brain
 * SQLite DB with the real schema.
 *
 * The 0000_init migration ends with an external-content FTS5 block
 * (`content='mail_inbox_messages'`). Tests do not need full-text search, so if
 * applying the migration whole fails (e.g. the sqlite3 CLI lacks FTS5), we fall
 * back to applying only the non-FTS statements and skip the FTS block.
 */
export function applySqliteTestBrainMigrations(dbPath: string): void {
  createPrismaMigrationsTable(dbPath);

  for (const migration of listMigrationFiles(brainMigrationsDir)) {
    const sql = fs.readFileSync(migration.sqlPath, "utf8");
    try {
      execSqlite(dbPath, sql);
    } catch {
      // Retry without the FTS5 section (virtual table + sync triggers).
      const ftsStart = sql.indexOf('CREATE VIRTUAL TABLE "mail_messages_fts"');
      const nonFtsSql = ftsStart >= 0 ? sql.slice(0, ftsStart) : sql;
      execSqlite(dbPath, nonFtsSql);
    }
    recordMigration(dbPath, migration.name, sql);
  }
}

export function createTestDatabaseUrl(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-db-"));
  const dbPath = path.join(tempDir, "test.db");
  const databaseUrl = `file:${dbPath}`;

  applySqliteTestMigrations(dbPath);

  return databaseUrl;
}

export function createTestBrainDatabaseUrl(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-brain-db-"));
  const dbPath = path.join(tempDir, "test.db");
  const databaseUrl = `file:${dbPath}`;

  applySqliteTestBrainMigrations(dbPath);

  return databaseUrl;
}

/**
 * Convenience: an isolated real Brain SQLite DB (schema applied) wrapped in a
 * ready {@link BrainPrismaClient}. Mirrors the common
 * `createPrismaClient(createTestDatabaseUrl())` pattern for the core DB.
 */
export function createTestBrainClient(): BrainPrismaClient {
  return createBrainPrismaClient(createTestBrainDatabaseUrl());
}
