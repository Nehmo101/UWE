/**
 * Lightweight Prisma migration sanity check for CI.
 * Verifies migration folders exist and schema validates without applying to production.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "packages/database/prisma/migrations");
const schemaPath = path.join(root, "packages/database/prisma/schema.prisma");

function fail(message) {
  console.error(`migration-check: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(schemaPath)) {
  fail("schema.prisma not found");
}

if (!fs.existsSync(migrationsDir)) {
  fail("migrations directory not found");
}

const migrationFolders = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "migration_lock.toml");

if (migrationFolders.length === 0) {
  fail("no migration folders found");
}

for (const folder of migrationFolders) {
  const sqlPath = path.join(migrationsDir, folder.name, "migration.sql");
  if (!fs.existsSync(sqlPath)) {
    fail(`missing migration.sql in ${folder.name}`);
  }
}

const validate = spawnSync(
  "pnpm",
  ["--filter", "@uwe/database", "exec", "prisma", "validate"],
  { cwd: root, stdio: "inherit", shell: false },
);

if (validate.status !== 0) {
  fail("prisma validate failed");
}

console.log(`migration-check: OK (${migrationFolders.length} migrations, schema valid)`);
