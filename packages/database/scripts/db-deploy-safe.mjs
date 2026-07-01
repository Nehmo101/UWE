#!/usr/bin/env node
/**
 * Applies Prisma migrations after a full backup (pre-migration safety net).
 * Usage: pnpm --filter @uwe/database db:deploy:safe
 *        pnpm db:deploy:safe   (from repo root)
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(packageRoot, "..", "..", "..");

function run(command, args, label) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    console.error(`\n✗ ${label} fehlgeschlagen (Exit ${result.status ?? 1}).`);
    process.exit(result.status ?? 1);
  }
}

console.log("UWE db:deploy:safe — Backup vor Migration");
run("pnpm", ["backup:create", "--type=full"], "Vollbackup erstellen");
run(
  "pnpm",
  ["exec", "prisma", "migrate", "deploy"],
  "Migrationen anwenden (packages/database)",
);
console.log("\n✓ db:deploy:safe abgeschlossen.");
