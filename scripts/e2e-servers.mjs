#!/usr/bin/env node
/**
 * Starts Studio + Portal against a shared isolated DB for Playwright E2E.
 */
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const studioPort = process.env.E2E_STUDIO_PORT ?? "3199";
const portalPort = process.env.E2E_PORTAL_PORT ?? "3200";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-e2e-"));
const databaseUrl = `file:${path.join(tempDir, "e2e.db")}`;
const stateFile = path.join(tempDir, "e2e-state.json");

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  SESSION_SECRET: `e2e-${"x".repeat(28)}`,
  UWE_SETUP_TOKEN: `setup-${"y".repeat(28)}`,
  SESSION_COOKIE_SECURE: "false",
  AUTH_REQUIRED: "true",
  NODE_ENV: "production",
  NEXT_PUBLIC_STUDIO_URL: `http://127.0.0.1:${studioPort}`,
  NEXT_PUBLIC_PORTAL_URL: `http://127.0.0.1:${portalPort}`,
  STUDIO_PORT: studioPort,
  PORTAL_PORT: portalPort,
  E2E_STATE_FILE: stateFile,
};

function run(command, args, cwd) {
  execSync([command, ...args].join(" "), {
    cwd,
    env,
    stdio: "inherit",
    shell: true,
  });
}

console.log(`[e2e] Preparing shared database at ${databaseUrl}`);
run("npx", ["prisma", "migrate", "deploy"], path.join(root, "packages/database"));

if (process.env.E2E_NO_SEED !== "1") {
  run("pnpm", ["exec", "tsx", "prisma/seed.ts"], path.join(root, "packages/database"));
}

fs.writeFileSync(
  stateFile,
  JSON.stringify({ databaseUrl, studioPort, portalPort }, null, 2),
  "utf8",
);

console.log("[e2e] Building Studio and Portal…");
run("pnpm", ["exec", "next", "build"], path.join(root, "apps/studio"));
run("pnpm", ["exec", "next", "build"], path.join(root, "apps/portal"));

const children = [
  spawn("pnpm", ["exec", "next", "start", "--port", studioPort], {
    cwd: path.join(root, "apps/studio"),
    env: { ...env, PUBLIC_BASE_URL: env.NEXT_PUBLIC_STUDIO_URL },
    stdio: "inherit",
  }),
  spawn("pnpm", ["exec", "next", "start", "--port", portalPort], {
    cwd: path.join(root, "apps/portal"),
    env: { ...env, PUBLIC_BASE_URL: env.NEXT_PUBLIC_PORTAL_URL },
    stdio: "inherit",
  }),
];

function cleanup() {
  for (const child of children) {
    child.kill("SIGTERM");
  }
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    cleanup();
    process.exit(0);
  });
}

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      cleanup();
      process.exit(code);
    }
  });
}
