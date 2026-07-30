#!/usr/bin/env node
/**
 * Packt die Release-Assets für den Windows-Installer: pro App ein
 * selbstenthaltendes Laufzeitverzeichnis, dazu die drei vormigrierten, leeren
 * Datenbanken. Der Installer lädt diese Archive nach, entpackt sie und startet
 * `node node_modules/next/dist/bin/next start` — kein pnpm, kein Build auf dem
 * Zielrechner.
 *
 * Warum `pnpm deploy` statt des Next-Standalone-Baums: Der Standalone-Output
 * ist nicht portabel — seine Symlinks zeigen absolut auf den Build-Rechner und
 * in den `.cache` des Repos. Sie aufzulösen bläht das Archiv um Faktor 7,5 auf
 * (pnpm-Store-Duplikate). `pnpm deploy` erzeugt das Laufzeitverzeichnis von
 * Grund auf, mit Symlinks, die ins EIGENE Verzeichnis zeigen.
 *
 * Die Symlinks selbst wandern NICHT ins Archiv: Auf Windows bräuchte ihr
 * Entpacken Adminrechte oder Developer-Mode. Stattdessen schreibt der Packer
 * sie als relative Paare nach `uwe-symlinks.json` und löscht sie vor dem tar;
 * der Installer stellt sie als Directory-Junctions wieder her — die brauchen
 * unter Windows keine Sonderrechte (pnpm selbst verlinkt dort genauso).
 *
 * WICHTIG: `--config.node-linker=hoisted` ist hier bewusst NICHT im Spiel. Der
 * Override lässt pnpm deploy den Lockfile ignorieren und veraltete Versionen
 * aus dem Store auflösen (gemessen: next 15.5.22 statt 16.2.12) — dieselbe
 * Config-Verwirrung, die am 2026-07-30 den Arbeitsbaum geleert hat.
 *
 * ACHTUNG Betriebsregel: `pnpm deploy` NIEMALS von Hand mit einem Ziel im oder
 * am Repo aufrufen. Ein fehlgelaufener Deploy hat am 2026-07-30 den kompletten
 * Arbeitsbaum geleert und den pnpm-State vergiftet (jeder folgende `pnpm
 * install` leerte den Baum erneut). Dieses Skript erzwingt ein repo-fremdes
 * Ziel und prüft nach jedem Deploy, dass der Arbeitsbaum unversehrt ist.
 *
 * Usage:
 *   node scripts/build-release-bundles.mjs --version 0.1.0 [--out release-assets]
 *     [--apps studio,portal] [--skip-databases] [--keep-work]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const ROOT = path.resolve(import.meta.dirname, "..");
const ALL_APPS = ["studio", "portal", "brain", "family", "landing"];

/** Module, ohne die keine der Apps startet — Gate vor dem Packen. */
const PFLICHTMODULE = ["next", "react", "react-dom", "@uwe/database", "@uwe/config/next-standalone"];
/** Prisma-Laufzeit: muss aus @uwe/database heraus auflösbar sein. */
const PRISMA_MODULE = ["@prisma/client", "@prisma/adapter-libsql", "@libsql/client", "@libsql/core/config"];

const DATABASES = [
  { file: "uwe.db", script: "db:deploy", env: "DATABASE_URL" },
  { file: "uwe-brain.db", script: "db:deploy:brain", env: "BRAIN_DATABASE_URL" },
  { file: "uwe-family.db", script: "db:deploy:family", env: "FAMILY_DATABASE_URL" },
];

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

const argv = process.argv.slice(2);
const version = argValue(argv, "--version");
const outDir = path.resolve(ROOT, argValue(argv, "--out") || "release-assets");
const appsArg = argValue(argv, "--apps");
const skipDatabases = argv.includes("--skip-databases");
const keepWork = argv.includes("--keep-work");

if (!version) {
  console.error("Usage: build-release-bundles.mjs --version X.Y.Z [--out dir] [--apps a,b]");
  process.exit(1);
}

const apps = appsArg ? appsArg.split(",").map((a) => a.trim()).filter(Boolean) : ALL_APPS;
for (const app of apps) {
  if (!ALL_APPS.includes(app)) {
    console.error(`Unbekannte App "${app}". Erlaubt: ${ALL_APPS.join(", ")}`);
    process.exit(1);
  }
}

/** pnpm über cmd.exe (Batch-Datei) — Muster wie in desktop-host-system.ts. */
function pnpm(args, opts = {}) {
  const cmd =
    process.platform === "win32"
      ? { command: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", args: ["/d", "/s", "/c", "corepack", "pnpm", ...args] }
      : { command: "corepack", args: ["pnpm", ...args] };
  execFileSync(cmd.command, cmd.args, { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"], ...opts });
}

/**
 * Wächter gegen den Unfall vom 2026-07-30: Nach jedem pnpm-Aufruf muss der
 * Arbeitsbaum noch alle App-Manifeste tragen. Fehlt eines, sofort abbrechen —
 * bevor ein weiterer pnpm-Lauf den vergifteten State fortschreibt.
 */
function repoUnversehrt(phase) {
  for (const app of ALL_APPS) {
    if (!fs.existsSync(path.join(ROOT, "apps", app, "package.json"))) {
      console.error(
        `ABBRUCH nach "${phase}": apps/${app}/package.json fehlt — der Arbeitsbaum wurde verändert.\n` +
          "Wiederherstellung: git restore . && node_modules löschen && pnpm install",
      );
      process.exit(2);
    }
  }
}

function tarCreate(archivePath, cwd) {
  const ziel = fs.openSync(archivePath, "w");
  try {
    execFileSync("tar", ["-czf", "-", "."], { cwd, stdio: ["ignore", ziel, "inherit"], maxBuffer: 1024 * 1024 * 1024 });
  } finally {
    fs.closeSync(ziel);
  }
}

/** Alle Symlinks unterhalb von dir (absolut), ohne ihnen zu folgen. */
function findeSymlinks(dir) {
  const links = [];
  const stapel = [dir];
  while (stapel.length) {
    const d = stapel.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) links.push(p);
      else if (e.isDirectory()) stapel.push(p);
    }
  }
  return links;
}

/**
 * Symlinks aus dem Bundle herauslösen: als relative Link→Ziel-Paare in
 * `uwe-symlinks.json` festhalten und die Links selbst entfernen. Ein Ziel
 * außerhalb des Bundles wäre auf dem Zielrechner tot und bricht den Build.
 */
function externalisiereSymlinks(bundle) {
  const eintraege = [];
  let entfernt = 0;
  for (const link of findeSymlinks(bundle)) {
    const ziel = fs.realpathSync(link);
    const relLink = path.relative(bundle, link);
    if (path.relative(bundle, ziel).startsWith("..")) {
      // pnpm's versteckter Hoist (.pnpm/node_modules/*) verlinkt auch
      // Workspace-Pakete, die das Bundle nie deklariert hat — die Ziele liegen
      // im Repo des Build-Rechners und wären auf dem Zielrechner tot. Solche
      // Phantom-Links fliegen raus; ob etwas WIRKLICH fehlt, entscheidet das
      // Modul-Gate unten, das die deklarierte Laufzeitkette auflöst.
      fs.rmSync(link, { recursive: false, force: true });
      entfernt += 1;
      continue;
    }
    const relZiel = path.relative(path.dirname(link), ziel);
    eintraege.push({ link: relLink.split(path.sep).join("/"), target: relZiel.split(path.sep).join("/") });
    fs.rmSync(link, { recursive: false, force: true });
  }
  fs.writeFileSync(path.join(bundle, "uwe-symlinks.json"), `${JSON.stringify(eintraege, null, 1)}\n`, "utf8");
  if (entfernt > 0) console.log(`  ${entfernt} Phantom-Links (Ziele außerhalb) entfernt`);
  return eintraege.length;
}

/**
 * Gegenstück zum Installer (restoreBundleSymlinks in bundle-install.ts): stellt
 * die Links als Junctions/Symlinks wieder her. Läuft hier im Packer einmal
 * PROBEWEISE, damit das Modul-Gate gegen exakt den Zustand testet, den der
 * Zielrechner nach dem Entpacken hat.
 */
function stelleSymlinksWiederHer(bundle) {
  const eintraege = JSON.parse(fs.readFileSync(path.join(bundle, "uwe-symlinks.json"), "utf8"));
  for (const { link, target } of eintraege) {
    const linkAbs = path.join(bundle, ...link.split("/"));
    const zielAbs = path.resolve(path.dirname(linkAbs), ...target.split("/"));
    fs.mkdirSync(path.dirname(linkAbs), { recursive: true });
    fs.rmSync(linkAbs, { recursive: true, force: true });
    fs.symlinkSync(zielAbs, linkAbs, process.platform === "win32" ? "junction" : "dir");
  }
  return eintraege.length;
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Arbeitsverzeichnis IMMER außerhalb des Repos — nie ein Deploy-Ziel im Baum.
const werk = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-bundles-"));
fs.mkdirSync(outDir, { recursive: true });
const erzeugt = [];

try {
  for (const app of apps) {
    const nextDir = path.join(ROOT, "apps", app, ".next");
    if (!fs.existsSync(path.join(nextDir, "BUILD_ID"))) {
      console.error(`Build fehlt für ${app}: apps/${app}/.next/BUILD_ID — erst \`pnpm build:release\`.`);
      process.exit(1);
    }

    const bundle = path.join(werk, app);
    console.log(`\n[${app}] pnpm deploy …`);
    pnpm(["--filter", `@uwe/${app}`, "deploy", "--legacy", "--prod", bundle]);
    repoUnversehrt(`deploy ${app}`);

    // pnpm deploy kopiert die Projektdateien MITSAMT einem evtl. vorhandenen
    // .next — inklusive Webpack-Cache (hunderte MB) und dem nicht portablen
    // standalone-Baum. Beides raus, dann den Build sauber gefiltert übernehmen.
    fs.rmSync(path.join(bundle, ".next"), { recursive: true, force: true });

    // Den gebauten .next hineinlegen — ohne cache (nur Build-Beschleuniger)
    // und ohne standalone (der nicht-portable Baum, um den es hier gerade
    // NICHT gehen soll).
    console.log(`[${app}] .next übernehmen …`);
    fs.cpSync(nextDir, path.join(bundle, ".next"), {
      recursive: true,
      filter: (src) => {
        const rel = path.relative(nextDir, src);
        return !(rel === "cache" || rel.startsWith("cache" + path.sep) || rel === "standalone" || rel.startsWith("standalone" + path.sep));
      },
    });

    // Next 16 externalisiert @prisma/* und Konsorten (serverExternalPackages)
    // und ruft sie zur Laufzeit VOM APP-ROOT auf — nicht über die Import-Kette
    // von @uwe/database. Im pnpm-Layout liegen sie aber nur im Store. Deshalb:
    // jede direkte Laufzeit-Dependency von @uwe/database bekommt einen
    // Top-Level-Alias in node_modules/, sofern dort noch keiner liegt. Die
    // Links wandern gleich mit in uwe-symlinks.json.
    const dbPaket = fs.realpathSync(path.join(bundle, "node_modules", "@uwe", "database"));
    const dbDeps = Object.keys(
      JSON.parse(fs.readFileSync(path.join(dbPaket, "package.json"), "utf8")).dependencies ?? {},
    );
    // Dazu die Paket-Basen der Pflichtmodule: @libsql/core z. B. ist nur eine
    // transitive Abhängigkeit, wird aber per Subpath direkt importiert.
    for (const m of PRISMA_MODULE) {
      const basis = m.startsWith("@") ? m.split("/").slice(0, 2).join("/") : m.split("/")[0];
      if (!dbDeps.includes(basis)) dbDeps.push(basis);
    }
    const dbRequire = createRequire(path.join(dbPaket, "package.json"));
    let aliase = 0;
    for (const dep of dbDeps) {
      const alias = path.join(bundle, "node_modules", ...dep.split("/"));
      if (fs.existsSync(alias)) continue;
      // Paketwurzel finden. Drei Wege, weil exports-Felder alles Mögliche
      // verbieten: ./package.json direkt, der Haupteinstieg, oder ein bekannter
      // Subpath (z. B. exportiert @libsql/core weder "." noch ./package.json,
      // wohl aber ./config).
      const kandidaten = [`${dep}/package.json`, dep, ...PRISMA_MODULE.filter((m) => m.startsWith(`${dep}/`))];
      let paketRoot;
      for (const kandidat of kandidaten) {
        try {
          const aufgeloest = dbRequire.resolve(kandidat);
          const marker = `${path.sep}node_modules${path.sep}${dep.split("/").join(path.sep)}${path.sep}`;
          const i = aufgeloest.lastIndexOf(marker);
          if (i >= 0) {
            paketRoot = aufgeloest.slice(0, i + marker.length - 1);
            break;
          }
        } catch {
          // nächsten Kandidaten versuchen
        }
      }
      if (!paketRoot) continue;
      fs.mkdirSync(path.dirname(alias), { recursive: true });
      fs.symlinkSync(fs.realpathSync(paketRoot), alias, process.platform === "win32" ? "junction" : "dir");
      aliase += 1;
    }
    if (aliase > 0) console.log(`  ${aliase} Top-Level-Aliase für @uwe/database-Laufzeit angelegt`);

    // Symlinks externalisieren (uwe-symlinks.json), dann probeweise als
    // Junctions wiederherstellen und das Modul-Gate GEGEN GENAU DEN ZUSTAND
    // laufen lassen, den der Zielrechner nach dem Entpacken hat. Erst danach
    // werden die Links fürs Packen wieder entfernt.
    const anzahl = externalisiereSymlinks(bundle);
    stelleSymlinksWiederHer(bundle);

    const r = createRequire(path.join(bundle, "package.json"));
    for (const m of PFLICHTMODULE) r.resolve(m);
    // Die Prisma-Kette muss aus BEIDEN Blickwinkeln auflösen: aus dem Paket
    // heraus (Import-Kette) und vom App-Root (Next-16-Externalisierung).
    for (const m of PRISMA_MODULE) r.resolve(m);
    const rDb = createRequire(fs.realpathSync(path.join(bundle, "node_modules", "@uwe", "database", "package.json")));
    for (const m of PRISMA_MODULE) rDb.resolve(m);

    // Versionstreue: Das Bundle muss exakt die next-Fassung tragen, mit der
    // .next gebaut wurde — ein Mismatch fällt sonst erst beim Nutzer mit
    // kryptischen Manifestfehlern auf (gemessen: deploy mit config-Override
    // lieferte next 15 zu einem next-16-Build).
    const bundleNext = JSON.parse(
      fs.readFileSync(fs.realpathSync(path.join(bundle, "node_modules", "next", "package.json")), "utf8"),
    ).version;
    const appNext = JSON.parse(
      fs.readFileSync(
        fs.realpathSync(path.join(ROOT, "apps", app, "node_modules", "next", "package.json")),
        "utf8",
      ),
    ).version;
    if (bundleNext !== appNext) {
      console.error(`[${app}] next-Mismatch: Bundle ${bundleNext}, Build ${appNext}. Abbruch.`);
      process.exit(1);
    }
    console.log(`[${app}] ${anzahl} Symlinks externalisiert, Laufzeitmodule: ok, next ${bundleNext}`);

    // Für das Archiv müssen die Junctions wieder weg — tar folgt ihnen sonst
    // wie Verzeichnissen und dupliziert den Store.
    externalisiereSymlinks(bundle);

    const archiv = path.join(outDir, `uwe-${app}-${version}.tar.gz`);
    console.log(`[${app}] packe …`);
    tarCreate(archiv, bundle);
    const groesse = fs.statSync(archiv).size;
    erzeugt.push({ art: "app", name: app, datei: archiv, groesse });
    console.log(`[${app}] ${path.basename(archiv)} — ${mb(groesse)}`);

    if (!keepWork) fs.rmSync(bundle, { recursive: true, force: true });
  }

  if (!skipDatabases) {
    const dbDir = path.join(werk, "databases");
    fs.mkdirSync(dbDir, { recursive: true });
    console.log("\n[databases] erzeuge leere, migrierte Datenbanken …");
    for (const db of DATABASES) {
      const ziel = path.join(dbDir, db.file);
      const url = `file:${ziel.replace(/\\/g, "/")}`;
      pnpm(["--filter", "@uwe/database", db.script], { env: { ...process.env, [db.env]: url } });
      repoUnversehrt(`migrate ${db.file}`);
      if (!fs.existsSync(ziel)) {
        console.error(`[databases] ${db.script} hat ${db.file} nicht erzeugt.`);
        process.exit(1);
      }
      console.log(`[databases] ${db.file} — ${mb(fs.statSync(ziel).size)}`);
    }
    const archiv = path.join(outDir, `uwe-databases-${version}.tar.gz`);
    tarCreate(archiv, dbDir);
    const groesse = fs.statSync(archiv).size;
    erzeugt.push({ art: "databases", name: "databases", datei: archiv, groesse });
    console.log(`[databases] ${path.basename(archiv)} — ${mb(groesse)}`);
  }
} finally {
  if (!keepWork) fs.rmSync(werk, { recursive: true, force: true });
  else console.log(`\nArbeitsverzeichnis behalten: ${werk}`);
}

const gesamt = erzeugt.reduce((s, e) => s + e.groesse, 0);
console.log(`\n${erzeugt.length} Assets, zusammen ${mb(gesamt)} in ${path.relative(ROOT, outDir)}`);

const manifestArgs = erzeugt
  .filter((e) => e.art === "app")
  .map((e) => `--app ${e.name}=${path.relative(ROOT, e.datei)}`);
const dbAsset = erzeugt.find((e) => e.art === "databases");
if (dbAsset) manifestArgs.push(`--databases ${path.relative(ROOT, dbAsset.datei)}`);
console.log(`\nFürs Manifest:\n  ${manifestArgs.join(" \\\n  ")}`);
