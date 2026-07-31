import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  fetchLatestManifest,
  installAppBundles,
  installInitialDatabases,
  releaseAssetUrl,
  type ReleaseManifestV2,
} from "./bundle-install.ts";
import { beginHostProgress, reportHostStep } from "./desktop-host-progress.ts";
import { openExternalUrl, runningCommandCenterVersion } from "./desktop-host-system.ts";
import type { HostServiceId } from "./desktop-host-types.ts";
import { compareSemver } from "./release-tags.ts";

/**
 * Update einer Bundle-Installation — das Gegenstück zum git-basierten Update
 * des Monorepo-Checkouts (`applyDesktopHostUpdate`):
 *
 * 1. Manifest der neuesten Release laden und die Version vergleichen.
 * 2. Nur die App-Bundles nachladen, deren SHA-256 sich geändert hat.
 * 3. Vor der Migration die Datenbankdateien kopieren — das ersetzt den
 *    Backup-Ref des git-Wegs. Dann `prisma migrate deploy` aus der
 *    mitgelieferten CLI gegen die BESTEHENDEN Datenbanken; die
 *    Migrations-Dateien liegen im App-Bundle unter
 *    node_modules/@uwe/database/prisma/.
 */

export interface BundleUpdateResult {
  ok: boolean;
  message: string;
  updatedApps: HostServiceId[];
  fromVersion: string | null;
  toVersion: string | null;
}

export interface InstalledState {
  version: string | null;
  /** SHA-256 je installierter App, Stand der letzten Installation. */
  appHashes: Partial<Record<HostServiceId, string>>;
}

/**
 * Ergebnis des Update-Checks einer Bundle-Installation. Der Vergleich läuft
 * gegen das Manifest des neuesten Release-Tags — in dieser Welt gibt es kein
 * git, der Release-Tag ist die einzige Wahrheit über „was ist neu“.
 */
export interface BundleUpdateCheck {
  updateAvailable: boolean;
  installedVersion: string | null;
  latestVersion: string;
  latestTag: string;
  /** Apps, deren Bundle sich gegenüber dem installierten Stand geändert hat. */
  changedApps: HostServiceId[];
  /** Dateiname des Command-Center-Installers im Release, falls vorhanden. */
  installerFile: string | null;
  message: string;
}

function stateFile(installRoot: string): string {
  return path.join(installRoot, "installed-release.json");
}

export function readInstalledState(installRoot: string): InstalledState {
  try {
    return JSON.parse(fs.readFileSync(stateFile(installRoot), "utf8")) as InstalledState;
  } catch {
    return { version: null, appHashes: {} };
  }
}

export function writeInstalledState(installRoot: string, manifest: ReleaseManifestV2, apps: readonly HostServiceId[]): void {
  const vorher = readInstalledState(installRoot);
  const appHashes = { ...vorher.appHashes };
  for (const app of apps) {
    const asset = manifest.apps?.[app];
    if (asset) appHashes[app] = asset.sha256;
  }
  fs.writeFileSync(
    stateFile(installRoot),
    `${JSON.stringify({ version: manifest.version, appHashes }, null, 2)}\n`,
    "utf8",
  );
}

/** Die installierten Apps: alles unter <installRoot>/apps mit package.json. */
export function installedApps(installRoot: string): HostServiceId[] {
  const appsDir = path.join(installRoot, "apps");
  if (!fs.existsSync(appsDir)) return [];
  return fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(appsDir, e.name, "package.json")))
    .map((e) => e.name as HostServiceId);
}

/**
 * Was ein Release-Tag gegenüber dem installierten Stand bedeutet — bewusst rein
 * (Manifest + Zustand rein, Urteil raus), damit Update-Check und Update-Lauf
 * dieselbe Entscheidung treffen und nicht auseinanderlaufen können.
 *
 * Verglichen wird nicht nur die Version: Ein neu gebautes Release mit
 * identischem Bundle kostet keinen Download, ein Nachbau derselben Version mit
 * geänderter Prüfsumme wird dagegen erkannt.
 */
export function evaluateBundleUpdate(
  manifest: ReleaseManifestV2,
  state: InstalledState,
  apps: readonly HostServiceId[],
): BundleUpdateCheck {
  const changedApps = apps.filter((app) => {
    const asset = manifest.apps?.[app];
    return asset ? asset.sha256 !== state.appHashes[app] : false;
  });
  const updateAvailable = changedApps.length > 0 || state.version !== manifest.version;
  return {
    updateAvailable,
    installedVersion: state.version,
    latestVersion: manifest.version,
    latestTag: manifest.tag,
    changedApps,
    installerFile: manifest.windows?.nsis ?? null,
    message: updateAvailable
      ? `Update verfügbar: ${manifest.tag} (${manifest.version})` +
        (changedApps.length > 0
          ? ` — neu zu laden: ${changedApps.join(", ")}.`
          : " — keine Bundle-Änderungen.")
      : `UWE ist aktuell (${manifest.tag}).`,
  };
}

/** Update-Check einer Bundle-Installation gegen das neueste Release-Manifest. */
export async function checkBundleUpdate(installRoot: string): Promise<BundleUpdateCheck> {
  const manifest = await fetchLatestManifest();
  return evaluateBundleUpdate(manifest, readInstalledState(installRoot), installedApps(installRoot));
}

/**
 * Installer-URL, wenn das laufende Command Center hinter dem Release-Tag liegt —
 * sonst null. Die Desktop-App erneuert nur ihr eigener Installer; die App-Bundles
 * kommen über das Manifest.
 *
 * Ist die Fassung der laufenden App unbekannt (ein älterer Rust-Host reicht
 * `UWE_COMMAND_CENTER_VERSION` nicht durch), wird nichts geöffnet: ein
 * ungefragt gestarteter Installer wäre schlimmer als ein fehlender Hinweis.
 */
export function commandCenterInstallerUrl(manifest: ReleaseManifestV2): string | null {
  const datei = manifest.windows?.nsis;
  if (!datei) return null;
  const laufend = runningCommandCenterVersion();
  if (!laufend) return null;
  const ziel = manifest.commandCenterVersion ?? manifest.version;
  if (compareSemver(laufend, ziel) >= 0) return null;
  return releaseAssetUrl(manifest.tag, datei);
}

/**
 * Sicherungskopie der Datenbanken vor einer Migration. Kopiert wird die
 * .db-Datei samt -wal/-shm, damit ein konsistenter Stand zurückholbar ist
 * (siehe docs: das logische Backup deckt nicht alles ab).
 */
export function backupDatabases(dataDir: string, backupsDir: string): string | null {
  const namen = ["uwe.db", "uwe-brain.db", "uwe-family.db"];
  const vorhanden = namen.filter((n) => fs.existsSync(path.join(dataDir, n)));
  if (vorhanden.length === 0) return null;
  const stempel = new Date().toISOString().replace(/[:.]/g, "-");
  const ziel = path.join(backupsDir, `vor-update-${stempel}`);
  fs.mkdirSync(ziel, { recursive: true });
  for (const n of vorhanden) {
    for (const suffix of ["", "-wal", "-shm"]) {
      const quelle = path.join(dataDir, `${n}${suffix}`);
      if (fs.existsSync(quelle)) fs.copyFileSync(quelle, path.join(ziel, `${n}${suffix}`));
    }
  }
  return ziel;
}

/**
 * `prisma migrate deploy` für alle drei Datenbanken, aus der mitgelieferten
 * CLI (<installRoot>/runtime/prisma). Ist keine CLI installiert, wird die
 * Migration übersprungen und gemeldet — bei einem Update ohne Schemaänderung
 * ist das folgenlos, sonst verweigern die Apps beim Start mit der
 * Migrations-Statusprüfung den Dienst, statt still Daten zu beschädigen.
 */
export function migrateDatabases(installRoot: string, dataDir: string): { ran: boolean; detail: string } {
  const prismaCli = path.join(installRoot, "runtime", "prisma", "build", "index.js");
  if (!fs.existsSync(prismaCli)) {
    return { ran: false, detail: "Prisma-CLI nicht installiert — Migration übersprungen." };
  }
  const datenbankPaket = installedApps(installRoot)
    .map((app) => path.join(installRoot, "apps", app, "node_modules", "@uwe", "database"))
    .find((p) => fs.existsSync(path.join(p, "prisma", "schema.prisma")));
  if (!datenbankPaket) {
    return { ran: false, detail: "Kein @uwe/database mit Prisma-Schema in der Installation gefunden." };
  }

  const laeufe: Array<{ schema: string; env: string; db: string }> = [
    { schema: path.join("prisma", "schema.prisma"), env: "DATABASE_URL", db: "uwe.db" },
    { schema: path.join("prisma", "brain", "schema.prisma"), env: "BRAIN_DATABASE_URL", db: "uwe-brain.db" },
    { schema: path.join("prisma", "family", "schema.prisma"), env: "FAMILY_DATABASE_URL", db: "uwe-family.db" },
  ];
  for (const lauf of laeufe) {
    const url = `file:${path.join(dataDir, lauf.db).replace(/\\/g, "/")}`;
    execFileSync(
      process.execPath,
      [prismaCli, "migrate", "deploy", `--schema=${path.join(datenbankPaket, lauf.schema)}`],
      {
        cwd: datenbankPaket,
        stdio: ["ignore", "inherit", "inherit"],
        env: { ...process.env, [lauf.env]: url, DATABASE_URL: lauf.env === "DATABASE_URL" ? url : process.env.DATABASE_URL ?? url },
      },
    );
  }
  return { ran: true, detail: "Migrationen angewendet." };
}

/**
 * Initiale .env einer Bundle-Installation — nur wenn noch keine existiert.
 * Enthält genau die Werte, ohne die die Env-Validierung der Apps den Start
 * verweigert (SESSION_SECRET, UWE_SETUP_TOKEN, PUBLIC_BASE_URL), plus die
 * Datenbankpfade neben den Host-Daten. Geheimnisse werden zufällig erzeugt;
 * alles Weitere wird später im Command Center gepflegt (setHostEnv).
 */
export function ensureBundleEnv(installRoot: string, dataDir: string): boolean {
  const envFile = path.join(installRoot, ".env");
  if (fs.existsSync(envFile)) return false;
  const posix = (p: string) => p.replace(/\\/g, "/");
  const zeilen = [
    "# Von der UWE-Bundle-Installation erzeugt. Werte lassen sich im Command",
    "# Center unter Einstellungen ändern.",
    "NODE_ENV=production",
    `SESSION_SECRET=${crypto.randomBytes(48).toString("base64url")}`,
    `UWE_SETUP_TOKEN=${crypto.randomBytes(32).toString("base64url")}`,
    "PUBLIC_BASE_URL=http://127.0.0.1:3000",
    "NEXT_PUBLIC_STUDIO_URL=http://127.0.0.1:3000",
    "NEXT_PUBLIC_PORTAL_URL=http://127.0.0.1:3001",
    `DATABASE_URL=file:${posix(path.join(dataDir, "uwe.db"))}`,
    `BRAIN_DATABASE_URL=file:${posix(path.join(dataDir, "uwe-brain.db"))}`,
    `FAMILY_DATABASE_URL=file:${posix(path.join(dataDir, "uwe-family.db"))}`,
    `UWE_DATA_DIR=${posix(dataDir)}`,
    `UWE_UPLOADS_DIR=${posix(path.join(dataDir, "uploads"))}`,
    "",
  ];
  fs.mkdirSync(installRoot, { recursive: true });
  fs.writeFileSync(envFile, zeilen.join("\n"), "utf8");
  return true;
}

/**
 * Erstinstallation über den Release-Download: gewählte Apps laden, beim
 * allerersten Mal die leeren Datenbanken einspielen, Installationsstand
 * festhalten. Wiederholbar — bereits installierte Apps werden ersetzt,
 * bestehende Datenbanken und eine vorhandene .env bleiben grundsätzlich
 * unangetastet.
 */
export async function applyBundleInstall(
  apps: readonly HostServiceId[],
  installRoot: string,
  dataDir: string,
): Promise<BundleUpdateResult> {
  const manifest = await fetchLatestManifest();
  beginHostProgress(apps.length * 2 + 1);
  const envNeu = ensureBundleEnv(installRoot, dataDir);
  const dbs = await installInitialDatabases(manifest, dataDir);
  await installAppBundles(manifest, apps, installRoot);
  writeInstalledState(installRoot, manifest, apps);
  const teile = [`${apps.join(", ")} installiert (${manifest.version}).`];
  if (envNeu) teile.push("Neue .env mit erzeugten Geheimnissen angelegt.");
  if (dbs.reason) teile.push(dbs.reason);
  return { ok: true, message: teile.join(" "), updatedApps: [...apps], fromVersion: null, toVersion: manifest.version };
}

export async function applyBundleUpdate(
  installRoot: string,
  dataDir: string,
  backupsDir: string,
): Promise<BundleUpdateResult> {
  const stand = readInstalledState(installRoot);
  const manifest = await fetchLatestManifest();

  const apps = installedApps(installRoot);
  if (apps.length === 0) {
    return { ok: false, message: "Keine installierten Apps gefunden.", updatedApps: [], fromVersion: stand.version, toVersion: manifest.version };
  }

  // Dieselbe Entscheidung wie im Update-Check: nur nachladen, was sich laut
  // Prüfsumme geändert hat.
  const pruefung = evaluateBundleUpdate(manifest, stand, apps);
  const zuAktualisieren = pruefung.changedApps;

  // Die Desktop-App erneuert nur ihr eigener Installer. Sie kann hinter dem
  // Release-Tag liegen, während die Bundles schon aktuell sind — dann ist das
  // Öffnen des Installers die einzige verbleibende Arbeit.
  const installer = commandCenterInstallerUrl(manifest);

  if (!pruefung.updateAvailable) {
    if (installer) {
      openExternalUrl(installer);
      return {
        ok: true,
        message: `App-Bundles sind aktuell (${manifest.version}). Der Command-Center-Installer wurde geöffnet — bitte die App-Aktualisierung abschließen.`,
        updatedApps: [],
        fromVersion: stand.version,
        toVersion: manifest.version,
      };
    }
    return { ok: true, message: `Bereits aktuell (${manifest.version}).`, updatedApps: [], fromVersion: stand.version, toVersion: manifest.version };
  }

  beginHostProgress(zuAktualisieren.length * 2 + 2);

  reportHostStep("db-backup", "Datenbanken sichern");
  const backup = backupDatabases(dataDir, backupsDir);

  await installAppBundles(manifest, zuAktualisieren, installRoot);

  reportHostStep("db-migrate", "Datenbanken migrieren");
  const migration = migrateDatabases(installRoot, dataDir);

  writeInstalledState(installRoot, manifest, zuAktualisieren);

  const teile = [
    `Update auf ${manifest.version}: ${zuAktualisieren.length ? zuAktualisieren.join(", ") : "keine Bundle-Änderungen"}.`,
    migration.detail,
  ];
  if (backup) teile.push(`Sicherung: ${backup}`);
  if (installer) {
    openExternalUrl(installer);
    teile.push("Der Command-Center-Installer wurde geöffnet — bitte die App-Aktualisierung abschließen.");
  }
  return { ok: true, message: teile.join(" "), updatedApps: zuAktualisieren, fromVersion: stand.version, toVersion: manifest.version };
}
