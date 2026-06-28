import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "./client";

/**
 * Reports whether the database schema matches the migrations shipped with
 * this build. Reads Prisma's `_prisma_migrations` table and — when the
 * migrations directory is available on disk — compares it against the
 * expected migration list.
 */

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export interface MigrationStatus {
  ok: boolean;
  appliedCount: number;
  /** Migrations on disk that have not been applied yet. */
  pendingMigrations: string[];
  /** Migrations that started but never finished (broken state). */
  failedMigrations: string[];
  message: string;
}

interface MigrationRow {
  migration_name: string;
  finished_at: string | null;
  rolled_back_at: string | null;
}

export function listMigrationDirectories(): string[] | null {
  const migrationsDir = path.resolve(packageRoot, "..", "prisma", "migrations");
  try {
    return fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) =>
        fs.existsSync(path.join(migrationsDir, entry.name, "migration.sql")),
      )
      .map((entry) => entry.name)
      .sort();
  } catch {
    return null;
  }
}

export async function getMigrationStatus(db: PrismaClient): Promise<MigrationStatus> {
  let rows: MigrationRow[];
  try {
    rows = await db.$queryRawUnsafe<MigrationRow[]>(
      'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name',
    );
  } catch {
    return {
      ok: false,
      appliedCount: 0,
      pendingMigrations: [],
      failedMigrations: [],
      message:
        "Migrations-Tabelle nicht lesbar — wurde `prisma migrate deploy` ausgeführt?",
    };
  }

  const applied = rows.filter((row) => row.finished_at !== null);
  const failed = rows.filter(
    (row) => row.finished_at === null && row.rolled_back_at === null,
  );

  const onDisk = listMigrationDirectories();
  const appliedNames = new Set(applied.map((row) => row.migration_name));
  const pending = onDisk
    ? onDisk.filter((name) => !appliedNames.has(name))
    : [];

  const ok = failed.length === 0 && pending.length === 0;

  let message = `${applied.length} Migration(en) angewendet.`;
  if (failed.length > 0) {
    message = `${failed.length} Migration(en) in fehlerhaftem Zustand: ${failed
      .map((row) => row.migration_name)
      .join(", ")}.`;
  } else if (pending.length > 0) {
    message = `${pending.length} Migration(en) ausstehend: ${pending.join(", ")}.`;
  } else if (onDisk === null) {
    message = `${applied.length} Migration(en) angewendet (Migrationsordner nicht verfügbar — kein Abgleich möglich).`;
  }

  return {
    ok,
    appliedCount: applied.length,
    pendingMigrations: pending,
    failedMigrations: failed.map((row) => row.migration_name),
    message,
  };
}
