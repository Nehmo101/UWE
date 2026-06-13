/**
 * Cross-platform test runner for packages using node:test.
 * Windows does not expand glob patterns in npm scripts — this collects files explicitly.
 */
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

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
