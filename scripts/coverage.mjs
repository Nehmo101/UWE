#!/usr/bin/env node
/**
 * On-demand test coverage for workspace packages (no extra dependencies).
 *
 * Runs each package's node:test files with Node's built-in
 * `--experimental-test-coverage` (V8 coverage + tsx source maps) and prints
 * the per-file coverage table plus a compact per-package summary.
 *
 * Usage:
 *   node scripts/coverage.mjs                    # default: packages/database
 *   node scripts/coverage.mjs packages/calendar packages/shared-utils
 *   node scripts/coverage.mjs apps/rtx-connector-client
 *
 * Not wired into CI on purpose — this is a local analysis tool.
 * Caveat: coverage is measured on the tsx-transformed modules and mapped back
 * via source maps; files that are never imported by any test do not appear in
 * the report at all (V8 only instruments loaded modules), so 100% here does
 * not mean every file in the package is covered.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(import.meta.url), "../..");

async function collectTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTestFiles(fullPath)));
      continue;
    }
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

async function resolvePackageDir(arg) {
  const dir = resolve(repoRoot, arg);
  const info = await stat(dir).catch(() => null);
  if (!info?.isDirectory() || !existsSync(join(dir, "package.json"))) {
    console.error(`Kein Workspace-Package gefunden: ${arg}`);
    return null;
  }
  return dir;
}

async function runCoverage(packageDir) {
  const label = relative(repoRoot, packageDir);
  // Same convention as scripts/run-node-tests.mjs: tests live under src/;
  // packages without src/ (e.g. packages/config) keep tests at the root.
  const testRoot = existsSync(join(packageDir, "src")) ? join(packageDir, "src") : packageDir;
  const tests = await collectTestFiles(testRoot);

  if (tests.length === 0) {
    console.log(`\n=== ${label}: keine *.test.ts(x) Dateien — übersprungen ===`);
    return { label, skipped: true, ok: true };
  }

  console.log(`\n=== Coverage: ${label} (${tests.length} Testdatei(en)) ===`);
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--test",
      "--experimental-test-coverage",
      // Keep the report focused on product code.
      "--test-coverage-exclude=**/*.test.ts",
      "--test-coverage-exclude=**/*.test.tsx",
      "--test-coverage-exclude=**/node_modules/**",
      "--test-reporter=spec",
      ...tests,
    ],
    { cwd: packageDir, stdio: "inherit", shell: false },
  );

  return { label, skipped: false, ok: result.status === 0 };
}

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const targets = args.length > 0 ? args : ["packages/database"];

const results = [];
for (const target of targets) {
  const dir = await resolvePackageDir(target);
  if (!dir) {
    results.push({ label: target, skipped: false, ok: false });
    continue;
  }
  results.push(await runCoverage(dir));
}

console.log("\n=== Zusammenfassung ===");
for (const { label, skipped, ok } of results) {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${skipped ? " (keine Tests)" : ""}`);
}

process.exit(results.every((entry) => entry.ok) ? 0 : 1);
