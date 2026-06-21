#!/usr/bin/env node
/**
 * Verify Prisma/libsql runtime modules resolve inside a Next.js standalone output.
 *
 * Usage:
 *   node scripts/check-standalone-prisma-deps.mjs [studio|portal]
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const REQUIRED_MODULES = [
  "@prisma/adapter-libsql",
  "@prisma/adapter-pg",
  "@libsql/client",
  "pg",
];

const app = process.argv[2] ?? "studio";
if (app !== "studio" && app !== "portal") {
  console.error(`Unknown app "${app}". Expected studio or portal.`);
  process.exit(2);
}

const standaloneDir = path.join(ROOT, "apps", app, ".next", "standalone");
if (!fs.existsSync(standaloneDir)) {
  console.error(`Standalone output missing: ${standaloneDir}`);
  process.exit(1);
}

const requireFromStandalone = createRequire(path.join(standaloneDir, "package.json"));
let failed = false;

console.log(`Checking standalone runtime modules for ${app}: ${standaloneDir}`);

for (const moduleName of REQUIRED_MODULES) {
  try {
    const resolved = requireFromStandalone.resolve(moduleName);
    const relative = path.relative(standaloneDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      failed = true;
      console.error(`  FAIL ${moduleName}: resolves outside standalone dir -> ${resolved}`);
      continue;
    }
    if (resolved.includes(`${path.sep}.cache${path.sep}standalone-prisma-deps${path.sep}`)) {
      failed = true;
      console.error(
        `  FAIL ${moduleName}: still linked to build cache — re-run materialize-standalone-prisma-deps`,
      );
      continue;
    }

    requireFromStandalone(moduleName);
    console.log(`  OK  ${moduleName} -> ${resolved}`);
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  FAIL ${moduleName}: ${message}`);
  }
}

const staticDir = path.join(standaloneDir, "apps", app, ".next", "static");
const generatedClient = path.join(
  standaloneDir,
  "packages",
  "database",
  "src",
  "generated",
  "prisma",
  "client.ts",
);
if (!fs.existsSync(staticDir)) {
  failed = true;
  console.error(`  FAIL static assets missing: ${staticDir}`);
} else {
  console.log(`  OK  static assets -> ${staticDir}`);
}

if (!fs.existsSync(generatedClient)) {
  failed = true;
  console.error(`  FAIL generated Prisma client missing: ${generatedClient}`);
} else {
  console.log(`  OK  generated Prisma client -> ${generatedClient}`);
}

if (failed) {
  console.error(
    "\nStandalone Prisma runtime dependencies are missing. Re-run: pnpm build (or setup-uwe-host.sh --repair).",
  );
  process.exit(1);
}
