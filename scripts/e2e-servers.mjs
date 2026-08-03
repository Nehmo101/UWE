#!/usr/bin/env node
/**
 * Starts Studio + Portal + Brain + Family against a shared isolated DB for
 * Playwright E2E.
 *
 * Brain und Family kamen nach: die bewegte Bühne war in beiden Apps nicht
 * eingebunden, und niemand hat es gemerkt, weil der Aufbau sie gar nicht
 * kannte. Sie bringen je eine eigene Datenbank mit (siehe
 * provisionSplitDatabase) und teilen sich das Sitzungs-Cookie mit Studio —
 * ein eigenes Anmeldeformular haben sie bewusst nicht.
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
 *   Physical label printing needs a local Maschinenraum connector with CUPS or
 *   UWE_CONNECTOR_PRINTERS — not available in GitHub Cloud CI. Host-side queue
 *   and document routes are covered by unit tests (label-print-queue-service.test.ts,
 *   capabilities.test.ts). A future e2e/studio-label-print.spec.ts could run on a
 *   self-hosted runner with STUDIO_API_TOKEN and a mocked connector, or stub CUPS via
 *   UWE_CONNECTOR_PRINT_CMD in tools/uwe-engine-connector/.env.example.
 *
 * Studio `/portal` shim (e2e/portal-auth.spec.ts):
 *   With separate Studio/Portal ports but unified-path deployment, the shim may
 *   redirect to `/portal` on the Studio origin rather than the Portal app URL.
 *   Cross-port redirect behaviour is owned by route-policy (Wave 3 C2).
 */
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const studioPort = process.env.E2E_STUDIO_PORT ?? "3199";
const portalPort = process.env.E2E_PORTAL_PORT ?? "3200";
const brainPort = process.env.E2E_BRAIN_PORT ?? "3201";
const familyPort = process.env.E2E_FAMILY_PORT ?? "3202";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-e2e-"));
const databaseUrl = `file:${path.join(tempDir, "e2e.db")}`;
const brainDatabasePath = path.join(tempDir, "e2e-brain.db");
const brainDatabaseUrl = `file:${brainDatabasePath}`;
const familyDatabasePath = path.join(tempDir, "e2e-family.db");
const familyDatabaseUrl = `file:${familyDatabasePath}`;
const stateFile = path.join(tempDir, "e2e-state.json");

/**
 * Welche Apps dieser Lauf baut und startet.
 *
 * Vier Builds kosten auf einem GitHub-Runner spürbar Zeit, und nicht jeder
 * Lauf braucht alle vier: der Auth-Smoke bei jedem Push auf main prüft Studio
 * und Portal und sonst nichts. `E2E_APPS=studio,portal` schneidet die anderen
 * beiden dann samt Build weg. Ohne die Variable läuft alles — ein Lauf, der
 * still weniger prüft als erwartet, wäre die schlechtere Voreinstellung.
 *
 * Studio ist nicht abwählbar: `playwright.config.ts` wartet auf dessen
 * `/login`, und Brain wie Family holen sich ihre Sitzung von dort.
 */
const ALL_APPS = ["studio", "portal", "brain", "family"];
const requestedApps = (process.env.E2E_APPS ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

for (const app of requestedApps) {
  if (!ALL_APPS.includes(app)) {
    console.error(`[e2e] Unbekannte App in E2E_APPS: "${app}" (erlaubt: ${ALL_APPS.join(", ")})`);
    process.exit(1);
  }
}

const apps = requestedApps.length > 0 ? [...new Set(["studio", ...requestedApps])] : ALL_APPS;

/**
 * Provision one of the split databases (PR #783 split Brain out of uwe.db,
 * Family followed with its own).
 *
 * `prisma migrate deploy` below only covers DATABASE_URL; without a migrated
 * Brain DB the seed dies in ensureSystemMailTemplates() with
 * `no such table: main.mail_templates`, because the `brainPrisma` singleton
 * would fall back to packages/database/data/uwe-brain.db (absent in CI, the
 * developer's real DB locally — both wrong for E2E). The same holds for
 * `familyPrisma`: the Family app would otherwise serve the developer's own
 * household data. Applies the SQL migrations via node:sqlite so no sqlite3 CLI
 * is needed and FTS5 works — same approach as scripts/run-node-tests.mjs.
 */
function provisionSplitDatabase(name, databasePath, url) {
  const migrationsDir = path.join(root, "packages", "database", "prisma", name, "migrations");
  const migrations = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(migrationsDir, entry.name, "migration.sql"))
    .filter((sqlPath) => fs.existsSync(sqlPath))
    .sort();
  const db = new DatabaseSync(databasePath);
  try {
    for (const sqlPath of migrations) db.exec(fs.readFileSync(sqlPath, "utf8"));
  } finally {
    db.close();
  }
  console.log(`[e2e] ${name} database ready (${migrations.length} migrations) at ${url}`);
}

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  BRAIN_DATABASE_URL: brainDatabaseUrl,
  FAMILY_DATABASE_URL: familyDatabaseUrl,
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
  // Brain und Family haben kein eigenes Anmeldeformular: ihre Login-Seiten
  // verlinken auf die Studio-Origin, und die Sitzung trägt über das gemeinsame
  // Cookie herüber (Cookies sind host-, nicht port-gebunden). Ohne diese
  // beiden Adressen zeigten Cross-App-Navigation und Bottom-Nav auf die
  // Entwicklungsports 3002/3004 statt auf die Testserver.
  NEXT_PUBLIC_BRAIN_URL: `http://127.0.0.1:${brainPort}`,
  NEXT_PUBLIC_FAMILY_URL: `http://127.0.0.1:${familyPort}`,
  STUDIO_PORT: studioPort,
  PORTAL_PORT: portalPort,
  BRAIN_PORT: brainPort,
  FAMILY_PORT: familyPort,
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
provisionSplitDatabase("brain", brainDatabasePath, brainDatabaseUrl);
provisionSplitDatabase("family", familyDatabasePath, familyDatabaseUrl);

if (process.env.E2E_NO_SEED !== "1") {
  run("pnpm", ["exec", "tsx", "prisma/seed.ts"], path.join(root, "packages/database"));
  // Der Seed vergibt bewusst nur Portal und Studio. Brain und Family kommen
  // hier dazu, damit die beiden Apps überhaupt betretbar sind — auf einer
  // weggeworfenen Datenbank, nicht im Dev-Seed. Siehe e2e-grant-areas.ts.
  run("node", ["--import", "tsx", "scripts/e2e-grant-areas.ts"], root);
}

fs.writeFileSync(
  stateFile,
  JSON.stringify(
    {
      databaseUrl,
      brainDatabaseUrl,
      familyDatabaseUrl,
      studioPort,
      portalPort,
      brainPort,
      familyPort,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`[e2e] Building ${apps.join(", ")}…`);
// Via each app's `build` script, NOT `next build` directly: the script first
// runs copy-scenes and copy-terra (scripts/copy-terra.mjs), which materialize
// public/scenes and public/terra. Skipping them ships a Studio/Portal without
// /terra/index.html — the Terra specs would then fail on a black frame. Für
// Brain und Family gilt dasselbe für `public/scenes`: ohne copy-scenes fehlen
// Standbilder *und* Clips, und die Bühnen-Tests liefen ins Leere.
for (const app of apps) {
  run("pnpm", ["run", "build"], path.join(root, "apps", app));
}

/**
 * Resolve the `next` CLI entry point for an app and spawn it with the current
 * Node binary. NOT `spawn("pnpm", …)`: on Windows pnpm is a `.CMD` shim that
 * spawn(shell:false) cannot start (ENOENT), and going through a shell would
 * mean SIGTERM hits the shell wrapper instead of the server on cleanup.
 */
function spawnNext(app, args, extraEnv) {
  const appDir = path.join(root, "apps", app);
  const appRequire = createRequire(pathToFileURL(path.join(appDir, "package.json")));
  const nextBin = appRequire.resolve("next/dist/bin/next");
  return spawn(process.execPath, [nextBin, ...args], {
    cwd: appDir,
    env: { ...env, ...extraEnv },
    stdio: "inherit",
  });
}

const SERVERS = {
  studio: [studioPort, env.NEXT_PUBLIC_STUDIO_URL],
  portal: [portalPort, env.NEXT_PUBLIC_PORTAL_URL],
  brain: [brainPort, env.NEXT_PUBLIC_BRAIN_URL],
  family: [familyPort, env.NEXT_PUBLIC_FAMILY_URL],
};

const children = apps.map((app) => {
  const [port, baseUrl] = SERVERS[app];
  return spawnNext(app, ["start", "--port", port], { PUBLIC_BASE_URL: baseUrl });
});

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
