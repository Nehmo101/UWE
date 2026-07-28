#!/usr/bin/env node
/**
 * Starts Studio against an isolated migrated+seeded SQLite DB for Playwright E2E.
 */
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.E2E_PORT ?? "3199";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-e2e-"));
const databaseUrl = `file:${path.join(tempDir, "e2e.db")}`;

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  SESSION_SECRET: `e2e-${"x".repeat(28)}`,
  UWE_SETUP_TOKEN: `setup-${"y".repeat(28)}`,
  PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
  SESSION_COOKIE_SECURE: "false",
  // E2E runs the production build over plain HTTP (SESSION_COOKIE_SECURE=false),
  // which enforceEnvSafetyAtBoot() would otherwise abort. Test-only opt-out.
  UWE_ALLOW_INSECURE_ENV: "1",
  AUTH_REQUIRED: "true",
  NODE_ENV: "production",
  NEXT_PUBLIC_STUDIO_URL: `http://127.0.0.1:${port}`,
  STUDIO_PORT: port,
};

function run(command, args, cwd) {
  execSync([command, ...args].join(" "), {
    cwd,
    env,
    stdio: "inherit",
    shell: true,
  });
}

console.log(`[e2e] Preparing database at ${databaseUrl}`);
run("npx", ["prisma", "migrate", "deploy"], path.join(root, "packages/database"));
run("pnpm", ["exec", "tsx", "prisma/seed.ts"], path.join(root, "packages/database"));

console.log("[e2e] Building Studio…");
run("pnpm", ["exec", "next", "build"], path.join(root, "apps/studio"));

console.log(`[e2e] Starting Studio on port ${port}…`);
const child = spawn("pnpm", ["exec", "next", "start", "--port", port], {
  cwd: path.join(root, "apps/studio"),
  env,
  stdio: "inherit",
});

function cleanup() {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore temp cleanup errors
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill("SIGTERM");
    cleanup();
    process.exit(0);
  });
}

child.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 0);
});
