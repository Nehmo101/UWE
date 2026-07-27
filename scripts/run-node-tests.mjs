/**
 * Cross-platform test runner for packages using node:test.
 * Windows does not expand glob patterns in npm scripts — this collects files explicitly.
 */
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Services that read the split databases through a shared singleton
 * (`brainPrisma`, `familyPrisma`) can't be handed a test client. Provision one
 * isolated, migrated database per split for the whole test run and point the
 * singleton at it, so those tests hit a real schema instead of the empty
 * default DB. The migrations are resolved relative to this script (repo root),
 * not the cwd — app packages run split-backed integration tests too. Uses
 * node:sqlite so no external sqlite3 CLI is needed.
 */
function provisionTestSplitDatabase(dir, envVar, prefix) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const migrationsDir = join(repoRoot, "packages", "database", "prisma", dir, "migrations");
  if (process.env[envVar] || !existsSync(migrationsDir)) return;

  const dbPath = join(mkdtempSync(join(tmpdir(), prefix)), `${dir}.db`);
  const db = new DatabaseSync(dbPath);
  try {
    const migrations = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(migrationsDir, entry.name, "migration.sql"))
      .filter((sqlPath) => existsSync(sqlPath))
      .sort();
    for (const sqlPath of migrations) db.exec(readFileSync(sqlPath, "utf8"));
  } finally {
    db.close();
  }
  process.env[envVar] = `file:${dbPath}`;
}

provisionTestSplitDatabase("brain", "BRAIN_DATABASE_URL", "uwe-brain-test-");
provisionTestSplitDatabase("family", "FAMILY_DATABASE_URL", "uwe-family-test-");

async function collectTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTestFiles(fullPath)));
      continue;
    }
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

const srcDir = join(process.cwd(), "src");
const tests = await collectTestFiles(srcDir);

if (tests.length === 0) {
  console.error(`No test files found under ${srcDir}`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...tests],
  { stdio: "inherit", shell: false },
);

process.exit(result.status ?? 1);
