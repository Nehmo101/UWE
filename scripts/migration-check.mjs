/**
 * Lightweight Prisma migration sanity check for CI.
 * Verifies migration folders exist and schema validates without applying to production.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseDir = path.join(root, "packages/database");
const migrationsDir = path.join(databaseDir, "prisma/migrations");
const schemaPath = path.join(databaseDir, "prisma/schema.prisma");

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

// Run the Prisma CLI through the current Node binary instead of spawning
// `pnpm`. On Windows, `pnpm` is a `.CMD` shim that spawnSync(shell:false)
// cannot execute (ENOENT / EINVAL) — same reason run-node-tests.mjs spawns
// `process.execPath` directly. Resolving the CLI entry point from
// packages/database also keeps us on the exact prisma version that package
// declares, and cuts pnpm's exit-code normalization out of the loop (see the
// drift check below, which relies on prisma's own exit codes).
const databaseRequire = createRequire(pathToFileURL(path.join(databaseDir, "package.json")));
let prismaCli;
try {
  prismaCli = databaseRequire.resolve("prisma/build/index.js");
} catch {
  fail("prisma CLI not found — run `pnpm install` first");
}

function runPrisma(args, options = {}) {
  return spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: databaseDir,
    shell: false,
    ...options,
  });
}

const validate = runPrisma(["validate"], { stdio: "inherit" });

if (validate.error) {
  fail(`prisma validate could not run: ${validate.error.message}`);
}
if (validate.status !== 0) {
  fail("prisma validate failed");
}

// Schema ↔ migrations drift check: detect when schema.prisma describes a state
// that the migrations do not produce (i.e. someone edited the schema without
// running `prisma migrate dev`). cwd is packages/database, so the relative
// ./prisma paths resolve there.
// `--exit-code`: 0 = in sync, 2 = drift detected, other = CLI/tooling error.
//
// This WARNS by default rather than failing, because the repository currently
// carries pre-existing drift (see docs) that can only be resolved with a real,
// data-touching migration. Set UWE_STRICT_MIGRATION_DRIFT=1 to make drift fatal
// once the schema and migrations are back in sync.
const strictDrift = process.env.UWE_STRICT_MIGRATION_DRIFT === "1";
const drift = runPrisma(
  [
    "migrate",
    "diff",
    "--from-migrations",
    "./prisma/migrations",
    "--to-schema",
    "./prisma/schema.prisma",
    "--exit-code",
  ],
  { encoding: "utf8" },
);

const driftOutput = `${drift.stdout ?? ""}${drift.stderr ?? ""}`.trim();

if (drift.error) {
  const message = `prisma migrate diff could not run: ${drift.error.message}`;
  if (strictDrift) fail(message);
  console.warn(`migration-check: WARN — ${message}`);
} else if (drift.status === 2) {
  const hint =
    "schema.prisma may contain changes not captured by the migrations — run " +
    "`pnpm --filter @uwe/database exec prisma migrate dev` to create a migration.";
  if (strictDrift) {
    if (driftOutput) console.error(driftOutput);
    fail(hint);
  }
  console.warn(`migration-check: WARN — ${hint}`);
  if (driftOutput) console.warn(driftOutput);
} else if (drift.status !== 0) {
  // Not drift — the CLI itself failed. Never hide that behind a drift warning.
  if (driftOutput) console.error(driftOutput);
  fail(`prisma migrate diff failed (exit ${drift.status})`);
} else {
  console.log(
    `migration-check: OK (${migrationFolders.length} migrations, schema valid, no drift)`,
  );
}
