#!/usr/bin/env node
/**
 * `pnpm verify:ui` — gezielter Screenshot-Lauf gegen einen Wegwerf-Stack.
 *
 * Beantwortet eine konkrete Frage über etwas Sichtbares und liefert dafür ein
 * Artefakt: Vollbilder plus ein Manifest mit Titel, HTTP-Status und den
 * sichtbaren Überschriften. Der Stack (frische Datenbanken, Migration, Seed,
 * eigene Zugangsdaten) kommt von `scripts/e2e-servers.mjs` über Playwrights
 * webServer — hier wird nichts davon nachgebaut.
 *
 *   pnpm verify:ui --routen "/worlds/terra/dashboard,/worlds/terra/kampagnen"
 *   pnpm verify:ui --als spieler --routen "/worlds/terra"
 *
 * Vor dem Start entscheidet `verify-ui-guard.mjs`, ob hier gestartet werden
 * darf: Der Lauf baut `apps/*​/.next` neu und würde im Haupt-Arbeitsbaum die
 * laufenden Live-Dienste mitnehmen. Siehe docs/engineering/verifikations-harness.md.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assessRunLocation,
  isPortAnswering,
  normalizeRoute,
  readLivePorts,
} from "./verify-ui-guard.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = { als: "dm", routen: [], ausgabe: null, apps: null };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--als" && value) { args.als = value; i += 1; }
    else if (key === "--routen" && value) {
      args.routen = value.split(",").map((route) => route.trim()).filter(Boolean);
      i += 1;
    } else if (key === "--ausgabe" && value) { args.ausgabe = value; i += 1; }
    else if (key === "--apps" && value) { args.apps = value; i += 1; }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.routen.length === 0) {
  console.error(
    "Fehlt: --routen \"/pfad,/anderer-pfad\"\n\n" +
      "  pnpm verify:ui --routen \"/worlds/terra/kampagnen\"\n" +
      "  pnpm verify:ui --als spieler --routen \"/worlds/terra\"",
  );
  process.exit(2);
}
if (args.als !== "dm" && args.als !== "spieler") {
  console.error(`--als kennt nur „dm" und „spieler", nicht „${args.als}".`);
  process.exit(2);
}

const routen = [];
for (const raw of args.routen) {
  const check = normalizeRoute(raw);
  if (!check.ok) {
    console.error(`\n${check.message}\n`);
    process.exit(2);
  }
  routen.push(check.route);
}

// --- Startsperre -----------------------------------------------------------
const gitDir = spawnSync("git", ["rev-parse", "--git-dir"], { cwd: repoRoot, encoding: "utf8" })
  .stdout?.trim() ?? "";
// Ein verknüpfter Arbeitsbaum meldet einen Pfad unter `.git/worktrees/…`.
const isMainWorktree = !gitDir.includes("worktrees");

const envPath = path.join(repoRoot, ".env");
const livePorts = fs.existsSync(envPath) ? readLivePorts(fs.readFileSync(envPath, "utf8")) : [];
const responding = [];
for (const port of livePorts) {
  if (await isPortAnswering(port)) responding.push(port);
}

const verifyPorts = [
  Number(process.env.E2E_STUDIO_PORT ?? 3199),
  Number(process.env.E2E_PORTAL_PORT ?? 3200),
];

const verdict = assessRunLocation({ isMainWorktree, livePorts, respondingLivePorts: responding, verifyPorts });
if (!verdict.allowed) {
  console.error(`\nverify:ui startet hier nicht.\n\n${verdict.message}\n`);
  process.exit(1);
}
if (verdict.message) console.warn(`${verdict.message}\n`);

// --- Lauf ------------------------------------------------------------------
const outputDir = path.resolve(
  args.ausgabe ?? path.join(os.tmpdir(), `uwe-verify-ui-${args.als}`),
);
fs.mkdirSync(outputDir, { recursive: true });

// Spielersicht braucht Portal; Studio startet der Stack ohnehin immer mit.
const apps = args.apps ?? (args.als === "spieler" ? "studio,portal" : "studio");
const spec = args.als === "spieler" ? "e2e/portal-verify-ui.spec.ts" : "e2e/studio-verify-ui.spec.ts";

console.log(`verify:ui · ${args.als} · ${routen.length} Route(n) · Ausgabe: ${outputDir}`);

// Der Prisma-Client wird nicht mitversioniert. In einem frischen Arbeitsbaum —
// und das ist hier der Regelfall — fehlt er, und der Seed scheitert mit
// „Cannot find module './generated/prisma/client'". Dieselbe Vorbereitung
// machen `test:e2e` und `qa:theme-matrix`.
const generate = spawnSync("pnpm", ["--filter", "@uwe/database", "db:generate"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (generate.status !== 0) {
  console.error("\nPrisma-Client konnte nicht erzeugt werden — Lauf abgebrochen.");
  process.exit(generate.status ?? 1);
}

const result = spawnSync(
  "pnpm",
  ["exec", "playwright", "test", spec],
  {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      E2E_APPS: apps,
      VERIFY_UI_ROUTES: routen.join(","),
      VERIFY_UI_OUT: outputDir,
      VERIFY_UI_AS: args.als,
    },
  },
);

const manifest = path.join(outputDir, `manifest-${args.als === "spieler" ? "portal" : "studio"}.json`);
if (fs.existsSync(manifest)) {
  console.log(`\nManifest: ${manifest}`);
  for (const entry of JSON.parse(fs.readFileSync(manifest, "utf8")).entries) {
    console.log(`  ${entry.status} ${entry.route} → ${entry.screenshot}`);
    console.log(`      ${entry.headings.slice(0, 3).join(" · ") || "(keine Überschrift)"}`);
  }
} else {
  console.error("\nKein Manifest entstanden — der Lauf hat keine Route erreicht.");
}

process.exit(result.status ?? 1);
