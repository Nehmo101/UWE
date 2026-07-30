#!/usr/bin/env node
/**
 * Die Release-Fassung an genau einer Stelle setzen.
 *
 * Fünf Dateien müssen dieselbe Version tragen, und jede hat einen Grund:
 *
 *   VERSION                                  Quelle der Wahrheit; der
 *                                            Release-Workflow prüft den Tag
 *                                            dagegen
 *   package.json                             Workspace-Fassung
 *   apps/rtx-connector-client/package.json   Fassung der Desktop-App
 *   …/src-tauri/tauri.conf.json              Fassung im Installer-Namen
 *   …/src-tauri/Cargo.toml                   CARGO_PKG_VERSION — daraus meldet
 *                                            das Command Center dem
 *                                            Update-Check, was gerade läuft
 *
 * Läuft eine davon aus dem Tritt, benennt sich die App anders als ihr Release
 * und der Update-Check sagt nie „aktuell". Deshalb: ein Befehl, nicht fünf
 * Handgriffe.
 *
 * Usage:
 *   node scripts/set-release-version.mjs 0.2.0        # nur die fünf Dateien
 *   node scripts/set-release-version.mjs 0.2.0 --pr   # + CHANGELOG, Branch, Commit
 *   node scripts/set-release-version.mjs --check      # prüfen (Exit 1 bei Drift)
 *
 * Den nackten Aufruf (ohne --pr) benutzt der Release-Workflow, damit der Build
 * und ein Versions-PR nicht zwei verschiedene Regeln anwenden. `--pr` ist der
 * Weg für Menschen und lässt bewusst zwei Dinge aus: es pusht nicht, und es
 * schreibt den CHANGELOG-Text nicht — es schiebt nur den vorhandenen
 * `[Unreleased]`-Abschnitt unter die neue Fassung, damit du kürzen statt tippen
 * musst.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SEMVER = /^\d+\.\d+\.\d+$/;

const VERSION_FILE = "VERSION";
const JSON_FILES = ["package.json", "apps/rtx-connector-client/package.json"];
const TAURI_CONF = "apps/rtx-connector-client/src-tauri/tauri.conf.json";
const CARGO_TOML = "apps/rtx-connector-client/src-tauri/Cargo.toml";
const CHANGELOG = "CHANGELOG.md";
const UNRELEASED = "## [Unreleased]";

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function write(relative, content) {
  fs.writeFileSync(path.join(ROOT, relative), content, "utf8");
}

/**
 * Die `version` im `[package]`-Abschnitt von Cargo.toml — nicht die der
 * Abhängigkeiten weiter unten. Deshalb wird nur der Abschnitt bis zur nächsten
 * `[…]`-Zeile angefasst.
 */
function cargoPackageSection(cargo) {
  const start = cargo.indexOf("[package]");
  if (start < 0) throw new Error(`Kein [package]-Abschnitt in ${CARGO_TOML}`);
  const end = cargo.indexOf("\n[", start + 1);
  return { start, end: end < 0 ? cargo.length : end };
}

function readCargoVersion(cargo) {
  const { start, end } = cargoPackageSection(cargo);
  return cargo.slice(start, end).match(/^version = "([^"]+)"/m)?.[1] ?? null;
}

function setCargoVersion(cargo, version) {
  const { start, end } = cargoPackageSection(cargo);
  const section = cargo.slice(start, end);
  const replaced = section.replace(/^version = "[^"]+"/m, `version = "${version}"`);
  if (replaced === section) {
    throw new Error(`Keine version-Zeile im [package]-Abschnitt von ${CARGO_TOML}`);
  }
  return cargo.slice(0, start) + replaced + cargo.slice(end);
}

/** Was die fünf Dateien gerade sagen. */
export function currentVersions() {
  const versions = { [VERSION_FILE]: read(VERSION_FILE).trim() };
  for (const file of [...JSON_FILES, TAURI_CONF]) {
    versions[file] = JSON.parse(read(file)).version ?? null;
  }
  versions[CARGO_TOML] = readCargoVersion(read(CARGO_TOML));
  return versions;
}

function setVersion(version) {
  write(VERSION_FILE, `${version}\n`);
  for (const file of [...JSON_FILES, TAURI_CONF]) {
    const json = JSON.parse(read(file));
    json.version = version;
    write(file, `${JSON.stringify(json, null, 2)}\n`);
  }
  write(CARGO_TOML, setCargoVersion(read(CARGO_TOML), version));
}

/**
 * Keep-a-Changelog-Ritual: `[Unreleased]` wird zur neuen Fassung, darüber
 * entsteht ein leeres `[Unreleased]`. Der Text wandert unverändert mit — was
 * sich geändert hat, weiß nur ein Mensch. `release.test.ts` verlangt einen
 * `[<version>]`-Abschnitt; der existiert damit von selbst.
 */
export function promoteChangelog(changelog, version, date) {
  const start = changelog.indexOf(UNRELEASED);
  if (start < 0) throw new Error(`Kein "${UNRELEASED}"-Abschnitt in ${CHANGELOG}`);
  if (changelog.includes(`## [${version}]`)) {
    throw new Error(`${CHANGELOG} hat bereits einen Abschnitt [${version}]`);
  }

  const bodyStart = start + UNRELEASED.length;
  const nextSection = changelog.indexOf("\n## [", bodyStart);
  const body = changelog.slice(bodyStart, nextSection < 0 ? undefined : nextSection).trim();
  const rest = nextSection < 0 ? "" : changelog.slice(nextSection);

  const promoted = `${UNRELEASED}\n\n## [${version}] - ${date}\n\n${body}\n`;
  return { changelog: changelog.slice(0, start) + promoted + rest, empty: body.length === 0 };
}

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function branchExists(branch) {
  try {
    git("rev-parse", "--verify", `refs/heads/${branch}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * `--pr` committet — also darf nichts Fremdes im Baum liegen, sonst landet es
 * mit im Release-Commit.
 */
function assertReadyForBranch(branch) {
  try {
    git("rev-parse", "--git-dir");
  } catch {
    throw new Error("--pr braucht ein git-Repository.");
  }
  if (git("status", "--porcelain")) {
    throw new Error(
      "Arbeitsbaum ist nicht sauber — committe oder stashe zuerst, sonst landet Fremdes im Release-Commit.",
    );
  }
  if (branchExists(branch)) {
    throw new Error(`Branch ${branch} existiert schon.`);
  }
}

function preparePr(version, date) {
  const branch = `release/v${version}`;
  assertReadyForBranch(branch);

  // Der CHANGELOG-Umbau zuerst: schlägt er fehl, ist noch kein Branch entstanden.
  const { changelog, empty } = promoteChangelog(read(CHANGELOG), version, date);

  const basis = git("rev-parse", "--abbrev-ref", "HEAD");
  if (basis !== "main") console.warn(`Hinweis: Basis ist ${basis}, nicht main.`);

  git("checkout", "-b", branch);
  setVersion(version);
  write(CHANGELOG, changelog);
  if (empty) console.warn(`Achtung: ${UNRELEASED} war leer — [${version}] hat keinen Inhalt.`);

  git("add", VERSION_FILE, ...JSON_FILES, TAURI_CONF, CARGO_TOML, CHANGELOG);
  git("commit", "-m", `chore(release): v${version}`);

  console.log(`set-release-version: ${version} auf ${branch} committet.`);
  console.log("");
  console.log("Jetzt du:");
  console.log(`  1. CHANGELOG.md prüfen — [${version}] trägt den bisherigen Unreleased-Text`);
  console.log("     unverändert; kürzen/sortieren, dann: git commit --amend -a");
  console.log(`  2. git push -u origin ${branch}`);
  console.log('  3. PR mergen, dann in Actions "UWE Windows Release" starten —');
  console.log(`     der Lauf legt den Tag uwe-v${version} selbst an`);
  return 0;
}

function checkVersions() {
  const versions = currentVersions();
  const distinct = [...new Set(Object.values(versions))];
  if (distinct.length !== 1 || !SEMVER.test(distinct[0] ?? "")) {
    console.error("Versionen laufen auseinander oder sind kein Semver:");
    for (const [file, value] of Object.entries(versions)) {
      console.error(`  ${file}: ${value}`);
    }
    console.error(`\nAngleichen mit: node scripts/set-release-version.mjs ${versions[VERSION_FILE]}`);
    return 1;
  }
  console.log(`set-release-version: OK (${distinct[0]}, 5 Dateien)`);
  return 0;
}

function main(argv) {
  if (argv.includes("--check")) return checkVersions();

  const version = argv.find((value) => !value.startsWith("--"));
  if (!version || !SEMVER.test(version)) {
    console.error("Usage: node scripts/set-release-version.mjs <X.Y.Z> [--pr] | --check");
    return 1;
  }

  // Lokales Datum — bewusst der Tag des Menschen, der das Release schneidet.
  const date = new Date().toISOString().slice(0, 10);
  if (argv.includes("--pr")) return preparePr(version, date);

  setVersion(version);
  console.log(`set-release-version: ${version} in 5 Dateien gesetzt.`);
  console.log("CHANGELOG.md unberührt — für den vollen Schnitt: --pr");
  return 0;
}

// Nur als CLI ausführen — die Helfer werden auch importiert (Tests).
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(`set-release-version: ${error.message}`);
    process.exit(1);
  }
}
