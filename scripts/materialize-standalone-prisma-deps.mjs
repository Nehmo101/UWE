#!/usr/bin/env node
/**
 * Merge @uwe/database runtime dependencies into Next.js standalone node_modules.
 * Mirrors the Docker production image strategy (pnpm deploy --prod + copy).
 *
 * Important: preserve pnpm symlinks (cp -a). Dereferencing breaks @libsql/core resolution.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
// Brain gehört dazu, seit es eigene public/-Assets ausliefert (Szenenbilder) —
// ohne diesen Eintrag 404en sie im Standalone-Build. Family ebenso: sie liest
// die Family-Datenbank und wird auf dem Host aus dem Standalone-Output
// gestartet (deploy/scripts/start-uwe.sh).
// Landing gehört dazu, weil der Apex-Origin ein eigener Standalone-Prozess ist
// (start-uwe.sh startet ihn auf LANDING_PORT): ohne die materialisierten
// Prisma-/libsql-Module startet er nicht, und die Hauptdomain fiele auf den
// Studio-Ingress zurück.
const APPS = ["studio", "portal", "brain", "family", "landing"];
const DEPLOY_DIR = path.join(ROOT, ".cache", "standalone-prisma-deps");

function copyPath(src, dest, { dereference = false } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }

  // Früher `cp -a` bzw. `cp -rL`. fs.cpSync macht dasselbe ohne Unix-Werkzeuge:
  // `verbatimSymlinks` kopiert Symlinks als Symlinks (das ist der `-a`-Fall, den
  // @libsql/core braucht), `dereference` folgt ihnen (der `-rL`-Fall). Auf einem
  // Windows-Runner gibt es kein `cp` im PATH — vorher brach der Release-Build
  // dort ab, bevor die Prisma-Module im Standalone-Baum landeten.
  fs.cpSync(src, dest, {
    recursive: true,
    preserveTimestamps: true,
    ...(dereference ? { dereference: true } : { verbatimSymlinks: true }),
  });
}

function mergePnpmStore(srcStore, destStore) {
  if (!fs.existsSync(srcStore)) {
    return;
  }

  fs.mkdirSync(destStore, { recursive: true });

  for (const entry of fs.readdirSync(srcStore)) {
    // pnpm's internal symlink hub — not real packages.
    if (entry === "node_modules") {
      continue;
    }

    copyPath(path.join(srcStore, entry), path.join(destStore, entry));
  }
}

function mergeDeployNodeModules(srcRoot, destRoot) {
  const srcNodeModules = path.join(srcRoot, "node_modules");
  const destNodeModules = path.join(destRoot, "node_modules");

  if (!fs.existsSync(srcNodeModules) || !fs.existsSync(destNodeModules)) {
    throw new Error(`node_modules missing under ${srcRoot} or ${destRoot}`);
  }

  mergePnpmStore(path.join(srcNodeModules, ".pnpm"), path.join(destNodeModules, ".pnpm"));

  for (const entry of fs.readdirSync(srcNodeModules)) {
    if (entry === ".pnpm" || entry === "node_modules") {
      continue;
    }

    if (entry === "@prisma") {
      const destScope = path.join(destNodeModules, "@prisma");
      fs.mkdirSync(destScope, { recursive: true });
      for (const pkg of ["adapter-libsql", "adapter-pg"]) {
        const srcPkg = path.join(srcNodeModules, "@prisma", pkg);
        if (fs.existsSync(srcPkg)) {
          copyPath(srcPkg, path.join(destScope, pkg));
        }
      }
      continue;
    }

    copyPath(path.join(srcNodeModules, entry), path.join(destNodeModules, entry));
  }
}

function materializeStaticAssets(app, standaloneDir) {
  const staticSrc = path.join(ROOT, "apps", app, ".next", "static");
  const staticDest = path.join(standaloneDir, "apps", app, ".next", "static");

  if (!fs.existsSync(staticSrc)) {
    console.warn(`[materialize] Skipping ${app} static assets: ${staticSrc} not found`);
    return;
  }

  copyPath(staticSrc, staticDest, { dereference: true });
}

function materializePublicAssets(app, standaloneDir) {
  // Next.js standalone output never includes `public/` on its own (documented
  // upstream requirement) — without this copy, every public asset (icons,
  // manifest, the embedded Terra map editor under public/terra/) 404s in
  // production, which for an iframed editor surfaces as the app's own
  // not-found page rendered inside the embed.
  const publicSrc = path.join(ROOT, "apps", app, "public");
  const publicDest = path.join(standaloneDir, "apps", app, "public");

  if (!fs.existsSync(publicSrc)) {
    console.warn(`[materialize] Skipping ${app} public assets: ${publicSrc} not found`);
    return;
  }

  copyPath(publicSrc, publicDest, { dereference: true });
}

function materializeApp(app) {
  const standaloneDir = path.join(ROOT, "apps", app, ".next", "standalone");
  if (!fs.existsSync(standaloneDir)) {
    console.warn(`[materialize] Skipping ${app}: standalone output not found`);
    return false;
  }

  mergeDeployNodeModules(DEPLOY_DIR, standaloneDir);

  const generatedSrc = path.join(ROOT, "packages", "database", "src", "generated");
  const generatedDest = path.join(standaloneDir, "packages", "database", "src", "generated");
  if (fs.existsSync(generatedSrc)) {
    copyPath(generatedSrc, generatedDest, { dereference: true });
  }

  materializeStaticAssets(app, standaloneDir);
  materializePublicAssets(app, standaloneDir);

  console.log(`[materialize] Updated standalone runtime deps for ${app}`);
  return true;
}

/**
 * Ohne Argument alle Apps, sonst genau die genannten. Der Filter existiert,
 * damit der Build **einer** App sich selbst materialisieren kann
 * (`pnpm --filter @uwe/landing build`), statt die vier anderen mitzukopieren.
 */
const requested = process.argv.slice(2);
const unknown = requested.filter((app) => !APPS.includes(app));
if (unknown.length > 0) {
  console.error(`[materialize] Unbekannte App(s): ${unknown.join(", ")}. Bekannt: ${APPS.join(", ")}`);
  process.exit(1);
}
const targets = requested.length > 0 ? requested : APPS;

const STAMP_FILE = path.join(DEPLOY_DIR, ".materialize-stamp");
const LOCK_DIR = `${DEPLOY_DIR}.lock`;

/**
 * Wovon der ausgelieferte Abhängigkeitsbaum abhängt: das Manifest von
 * @uwe/database und die Lockfile. Ändert sich keins von beiden, ist ein
 * vorhandenes Deploy-Verzeichnis noch gültig.
 */
function deployFingerprint() {
  return [path.join(ROOT, "pnpm-lock.yaml"), path.join(ROOT, "packages", "database", "package.json")]
    .map((file) => {
      try {
        return `${file}:${fs.statSync(file).mtimeMs}`;
      } catch {
        return `${file}:missing`;
      }
    })
    .join("|");
}

function stampMatches(fingerprint) {
  try {
    return fs.readFileSync(STAMP_FILE, "utf8") === fingerprint;
  } catch {
    return false;
  }
}

/**
 * `pnpm deploy` dauert Minuten und schreibt in ein gemeinsames Verzeichnis.
 * Seit die App-Builds sich selbst materialisieren, laufen bis zu fünf dieser
 * Skripte gleichzeitig (turbo baut parallel) — ohne Sperre räumten sie einander
 * das Verzeichnis unter den Füßen weg. Wer die Sperre nicht bekommt, wartet und
 * benutzt danach das Ergebnis des anderen.
 */
function acquireLock() {
  const deadline = Date.now() + 10 * 60 * 1000;
  fs.mkdirSync(path.dirname(LOCK_DIR), { recursive: true });
  for (;;) {
    try {
      fs.mkdirSync(LOCK_DIR); // atomar: schlägt fehl, wenn schon vorhanden
      return true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() > deadline) {
        // Lieber selbst deployen als ewig warten: eine verwaiste Sperre (harter
        // Abbruch eines früheren Laufs) darf den Build nicht dauerhaft blockieren.
        console.warn("[materialize] Sperre seit über 10 Minuten gehalten — wird übernommen.");
        fs.rmSync(LOCK_DIR, { recursive: true, force: true });
        continue;
      }
      // Synchron warten, ohne einen Prozess dafür zu starten.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
}

function releaseLock() {
  fs.rmSync(LOCK_DIR, { recursive: true, force: true });
}

const fingerprint = deployFingerprint();
let deployNeeded = !stampMatches(fingerprint);

if (deployNeeded) {
  acquireLock();
  try {
    // Nach dem Warten nochmal prüfen: in der Zwischenzeit kann ein anderer Lauf
    // genau das deployt haben, worauf wir gewartet haben.
    deployNeeded = !stampMatches(fingerprint);
    if (deployNeeded) {
      runDeploy(fingerprint);
    }
  } finally {
    releaseLock();
  }
}

function runDeploy(currentFingerprint) {
  fs.rmSync(DEPLOY_DIR, { recursive: true, force: true });
  fs.mkdirSync(DEPLOY_DIR, { recursive: true });

  // Auf Windows ist pnpm eine Batch-Datei, die execFileSync nicht direkt startet —
  // vorher scheiterte der Release-Build hier mit `spawnSync pnpm ENOENT`. Statt
  // `shell: true` (das die Argumente unescaped verkettet und DEP0190 auslöst) wird
  // cmd.exe explizit als Programm aufgerufen. Gleiches Muster wie `pnpmCommand`
  // in tools/uwe-host-command-center/src/desktop-host-system.ts.
  const pnpmArgs = ["--filter", "@uwe/database", "deploy", "--legacy", "--prod", DEPLOY_DIR];
  const pnpm =
    process.platform === "win32"
      ? {
          command: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
          args: ["/d", "/s", "/c", "corepack", "pnpm", ...pnpmArgs],
        }
      : { command: "corepack", args: ["pnpm", ...pnpmArgs] };

  execFileSync(pnpm.command, pnpm.args, { cwd: ROOT, stdio: "inherit" });
  fs.writeFileSync(STAMP_FILE, currentFingerprint, "utf8");
}

let materialized = 0;
for (const app of targets) {
  if (materializeApp(app)) {
    materialized += 1;
  }
}

if (materialized === 0) {
  console.error("[materialize] No standalone outputs found. Run next build first.");
  process.exit(1);
}
