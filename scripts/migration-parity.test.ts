import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * SQLite- und PostgreSQL-Migrationen müssen zusammen wandern.
 *
 * Ein 1:1-Abgleich der Verzeichnisnamen ist nicht möglich: Das
 * PostgreSQL-Verzeichnis beginnt mit einer Baseline (20260619000000), einzelne
 * SQLite-Migrationen sind dort konsolidiert, und Namen dürfen abweichen
 * (z. B. `engine_rename_connector_type` vs. `engine_rename_enums`). Was aber
 * IMMER gelten muss: Wer eine neue SQLite-Migration anlegt, legt im selben PR
 * das PostgreSQL-Gegenstück an. Der jüngste Zeitstempel beider Verzeichnisse
 * muss deshalb identisch sein — genau die Lücke, durch die
 * `20260803230000_page_portal_released` zunächst nur für SQLite existierte.
 */

const repoRoot = path.resolve(import.meta.dirname, "..");

function newestMigrationTimestamp(dir: string): string {
  const entries = fs
    .readdirSync(path.join(repoRoot, dir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .map((name) => /^(\d{14})_/.exec(name)?.[1])
    .filter((stamp): stamp is string => Boolean(stamp))
    .sort();
  assert.ok(entries.length > 0, `Keine Migrationen gefunden in ${dir}`);
  return entries[entries.length - 1];
}

test("die jüngste SQLite-Migration hat ein PostgreSQL-Gegenstück", () => {
  const sqlite = newestMigrationTimestamp("packages/database/prisma/migrations");
  const postgres = newestMigrationTimestamp(
    "packages/database/prisma/migrations-postgresql",
  );

  assert.ok(
    sqlite <= postgres,
    `Die SQLite-Migration ${sqlite} hat kein PostgreSQL-Gegenstück ` +
      `(jüngste PostgreSQL-Migration: ${postgres}). ` +
      `Bitte in packages/database/prisma/migrations-postgresql/ nachziehen.`,
  );
});

test("keine PostgreSQL-Migration ohne SQLite-Original", () => {
  const sqlite = newestMigrationTimestamp("packages/database/prisma/migrations");
  const postgres = newestMigrationTimestamp(
    "packages/database/prisma/migrations-postgresql",
  );

  assert.ok(
    postgres <= sqlite,
    `Die PostgreSQL-Migration ${postgres} hat kein SQLite-Original ` +
      `(jüngste SQLite-Migration: ${sqlite}).`,
  );
});
