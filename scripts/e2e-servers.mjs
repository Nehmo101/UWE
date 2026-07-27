#!/usr/bin/env node
/**
 * Starts Studio + Portal against a shared isolated DB for Playwright E2E.
 *
 * Portal login-first tests (no session → redirect /login) are in:
 *   e2e/portal-auth.spec.ts — "Portal login-first — unauthenticated redirect policy"
 *   e2e/portal-auth.spec.ts — "Studio /portal redirect shim"
 * Portal authenticated player flows (/auth/worlds, world detail) are in:
 *   e2e/portal-auth.spec.ts — "Portal authenticated player flows"
 * These run against the production build started here (NODE_ENV=production),
 * ensuring real middleware / CSP behaviour is exercised.
 *
 * Label-print E2E (deferred — QF10 hardware stub):
 *   Physical label printing needs a local RTX connector with CUPS or
 *   UWE_CONNECTOR_PRINTERS — not available in GitHub Cloud CI. Host-side queue
 *   and document routes are covered by unit tests (label-print-queue-service.test.ts,
 *   capabilities.test.ts). A future e2e/studio-label-print.spec.ts could run on a
 *   self-hosted runner with STUDIO_API_TOKEN and a mocked connector, or stub CUPS via
 *   UWE_CONNECTOR_PRINT_CMD in tools/uwe-rtx-connector/.env.example.
 *
 * Studio `/portal` shim (e2e/portal-auth.spec.ts):
 *   With separate Studio/Portal ports but unified-path deployment, the shim may
 *   redirect to `/portal` on the Studio origin rather than the Portal app URL.
 *   Cross-port redirect behaviour is owned by route-policy (Wave 3 C2).
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
  STUDIO_API_TOKEN: `e2e-studio-api-${"z".repeat(20)}`,
  SESSION_COOKIE_SECURE: "false",
  // E2E runs the production build over plain HTTP (SESSION_COOKIE_SECURE=false),
  // which enforceEnvSafetyAtBoot() would otherwise abort. Test-only opt-out.
  UWE_ALLOW_INSECURE_ENV: "1",
  // Studio session gate — matches production auth smoke (UWE login, no Cloudflare Access bypass).
  AUTH_REQUIRED: "true",
  PLAYER_PREVIEW_PUBLIC: "true",
  RUN_DB_SEED: "false",
  NODE_ENV: "production",
  // The demo seed refuses to run under NODE_ENV=production unless opted in.
  // E2E seeds a throwaway, isolated SQLite DB (tempDir/e2e.db) with the known
  // demo credentials the auth-smoke specs log in with — the intended opt-in.
  UWE_ALLOW_PROD_SEED: "1",
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
