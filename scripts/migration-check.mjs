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

// Schema ↔ migrations drift check: detect when schema.prisma describes a state
// that the migrations do not produce (i.e. someone edited the schema without
// running `prisma migrate dev`). `pnpm --filter @uwe/database exec` runs with
// cwd = packages/database, so the relative ./prisma paths resolve there.
// `--exit-code`: 0 = in sync, 2 = drift detected, other = CLI/tooling error.
//
// This WARNS by default rather than failing, because the repository currently
// carries pre-existing drift (see docs) that can only be resolved with a real,
// data-touching migration. Set UWE_STRICT_MIGRATION_DRIFT=1 to make drift fatal
// once the schema and migrations are back in sync.
const strictDrift = process.env.UWE_STRICT_MIGRATION_DRIFT === "1";
const drift = spawnSync(
  "pnpm",
  [
    "--filter",
    "@uwe/database",
    "exec",
    "prisma",
    "migrate",
    "diff",
    "--from-migrations",
    "./prisma/migrations",
    "--to-schema",
    "./prisma/schema.prisma",
    "--exit-code",
  ],
  { cwd: root, encoding: "utf8", shell: false },
);

// pnpm normalizes prisma's exit code (2 = drift) to 1, so we cannot distinguish
// drift from a tooling error by status alone; treat any non-zero as "not in
// sync" and surface prisma's own output for context.
const driftOutput = `${drift.stdout ?? ""}${drift.stderr ?? ""}`.trim();

if (drift.error) {
  const message = `prisma migrate diff could not run: ${drift.error.message}`;
  if (strictDrift) fail(message);
  console.warn(`migration-check: WARN — ${message}`);
} else if (drift.status !== 0) {
  const hint =
    "schema.prisma may contain changes not captured by the migrations — run " +
    "`pnpm --filter @uwe/database exec prisma migrate dev` to create a migration.";
  if (strictDrift) {
    if (driftOutput) console.error(driftOutput);
    fail(hint);
  }
  console.warn(`migration-check: WARN — ${hint}`);
  if (driftOutput) console.warn(driftOutput);
} else {
  console.log(
    `migration-check: OK (${migrationFolders.length} migrations, schema valid, no drift)`,
  );
}
