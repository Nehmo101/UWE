/**
 * Cross-platform test runner for packages using node:test.
 * Windows does not expand glob patterns in npm scripts — this collects files explicitly.
 */
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Services that read owner-private data through the shared `brainPrisma`
 * singleton (capture-triage, markdown-import, knowledge-assistant) can't be
 * handed a test client. If this package ships Brain migrations, provision one
 * isolated, migrated brain DB for the whole test run and point the singleton at
 * it via BRAIN_DATABASE_URL, so those tests hit a real schema instead of the
 * empty default DB. Uses node:sqlite so no external sqlite3 CLI is needed.
 */
function provisionTestBrainDatabase() {
  const brainMigrationsDir = join(process.cwd(), "prisma", "brain", "migrations");
  if (process.env.BRAIN_DATABASE_URL || !existsSync(brainMigrationsDir)) return;

  const dbPath = join(mkdtempSync(join(tmpdir(), "uwe-brain-test-")), "brain.db");
  const db = new DatabaseSync(dbPath);
  try {
    const migrations = readdirSync(brainMigrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(brainMigrationsDir, entry.name, "migration.sql"))
      .filter((sqlPath) => existsSync(sqlPath))
      .sort();
    for (const sqlPath of migrations) db.exec(readFileSync(sqlPath, "utf8"));
  } finally {
    db.close();
  }
  process.env.BRAIN_DATABASE_URL = `file:${dbPath}`;
}

provisionTestBrainDatabase();

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
