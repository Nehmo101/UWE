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
 *   node scripts/set-release-version.mjs 0.2.0     # setzen
 *   node scripts/set-release-version.mjs --check   # nur prüfen (Exit 1 bei Drift)
 *
 * Denselben Aufruf benutzt der Release-Workflow, damit der Build und ein
 * Versions-PR nicht zwei verschiedene Regeln anwenden.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SEMVER = /^\d+\.\d+\.\d+$/;

const VERSION_FILE = "VERSION";
const JSON_FILES = ["package.json", "apps/rtx-connector-client/package.json"];
const TAURI_CONF = "apps/rtx-connector-client/src-tauri/tauri.conf.json";
const CARGO_TOML = "apps/rtx-connector-client/src-tauri/Cargo.toml";

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

function main(argv) {
  const check = argv.includes("--check");
  const versionArg = argv.find((value) => !value.startsWith("--"));

  if (check) {
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

  if (!versionArg || !SEMVER.test(versionArg)) {
    console.error("Usage: node scripts/set-release-version.mjs <X.Y.Z> | --check");
    return 1;
  }

  setVersion(versionArg);
  console.log(`set-release-version: ${versionArg} in 5 Dateien gesetzt.`);
  console.log("Nicht vergessen: CHANGELOG.md-Eintrag für diese Fassung.");
  return 0;
}

// Nur als CLI ausführen — currentVersions() wird auch importiert (Tests).
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  process.exit(main(process.argv.slice(2)));
}
