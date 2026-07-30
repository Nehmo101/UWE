import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { reportHostStep } from "./desktop-host-progress.ts";
import type { HostServiceId } from "./desktop-host-types.ts";

/**
 * Download und Installation der Release-Bundles — der Weg der
 * Bundle-Installation (kein git, kein pnpm, kein Build auf dem Zielrechner).
 *
 * Vertrauensmodell: Geladen wird ausschließlich, was das Manifest
 * (`uwe-release.json`, schemaVersion 2) nennt. Jedes Asset wird beim
 * Herunterladen SHA-256-gehasht und gegen das Manifest geprüft, BEVOR es
 * entpackt wird; ein Asset mit falscher Summe wird gelöscht und der Vorgang
 * bricht ab. Die Manifest-Datei selbst kommt über GitHub-HTTPS.
 */

export const UWE_RELEASE_REPO = "Nehmo101/UWE";

export interface ReleaseAsset {
  file: string;
  sha256: string;
  size: number;
}

export interface ReleaseManifestV2 {
  schemaVersion: number;
  version: string;
  tag: string;
  runtime?: { node: string; nodeAbi: string; platform: string; arch: string };
  apps?: Partial<Record<HostServiceId, ReleaseAsset | null>>;
  databases?: ReleaseAsset | null;
}

function releaseDownloadUrl(tag: string, file: string, repo: string): string {
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(file)}`;
}

/** Manifest der neuesten Release laden (GitHub folgt von /latest/ per Redirect). */
export async function fetchLatestManifest(repo: string = UWE_RELEASE_REPO): Promise<ReleaseManifestV2> {
  const url = `https://github.com/${repo}/releases/latest/download/uwe-release.json`;
  const antwort = await fetch(url, { redirect: "follow" });
  if (!antwort.ok) {
    throw new Error(`Release-Manifest nicht erreichbar (${antwort.status}) — ${url}`);
  }
  const manifest = (await antwort.json()) as ReleaseManifestV2;
  if (manifest.schemaVersion < 2) {
    throw new Error(
      `Release ${manifest.version ?? "?"} trägt noch Manifest v${manifest.schemaVersion} ohne App-Bundles — ` +
        "die Bundle-Installation braucht ein Release mit schemaVersion 2.",
    );
  }
  return manifest;
}

/**
 * Native Module (better-sqlite3, Prisma-Query-Engine) sind an die Node-ABI
 * gebunden, mit der das Release gebaut wurde. Läuft hier eine andere, laden sie
 * nicht — dann lieber sofort mit klarer Meldung abbrechen als später mit einem
 * kryptischen dlopen-Fehler.
 */
export function assertRuntimeCompatible(manifest: ReleaseManifestV2): void {
  const runtime = manifest.runtime;
  if (!runtime) return;
  if (runtime.platform !== process.platform || runtime.arch !== process.arch) {
    throw new Error(
      `Release ist für ${runtime.platform}/${runtime.arch} gebaut, diese Laufzeit ist ${process.platform}/${process.arch}.`,
    );
  }
  if (runtime.nodeAbi && runtime.nodeAbi !== process.versions.modules) {
    throw new Error(
      `Node-ABI passt nicht: Release wurde mit Node ${runtime.node} (ABI ${runtime.nodeAbi}) gebaut, ` +
        `hier läuft ABI ${process.versions.modules}. Die mitgelieferte Node-Laufzeit verwenden.`,
    );
  }
}

/**
 * Ein Asset herunterladen und dabei streamend hashen. Die Prüfsumme wird nach
 * dem letzten Byte verglichen; bei Abweichung wird die Datei gelöscht.
 */
export async function downloadAndVerify(
  manifest: ReleaseManifestV2,
  asset: ReleaseAsset,
  zielDatei: string,
  repo: string = UWE_RELEASE_REPO,
): Promise<void> {
  const url = releaseDownloadUrl(manifest.tag, asset.file, repo);
  const antwort = await fetch(url, { redirect: "follow" });
  if (!antwort.ok || !antwort.body) {
    throw new Error(`Download fehlgeschlagen (${antwort.status}) — ${url}`);
  }

  fs.mkdirSync(path.dirname(zielDatei), { recursive: true });
  const hash = crypto.createHash("sha256");
  const handle = fs.openSync(zielDatei, "w");
  try {
    // Web-ReadableStream in einen Node-Stream heben — dessen async-Iteration
    // kennt auch der Typchecker.
    const strom = Readable.fromWeb(antwort.body as import("node:stream/web").ReadableStream);
    for await (const chunk of strom) {
      const puffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hash.update(puffer);
      fs.writeSync(handle, puffer);
    }
  } finally {
    fs.closeSync(handle);
  }

  const ist = hash.digest("hex");
  if (ist !== asset.sha256) {
    fs.rmSync(zielDatei, { force: true });
    throw new Error(
      `Prüfsumme von ${asset.file} stimmt nicht (erwartet ${asset.sha256.slice(0, 12)}…, ` +
        `bekommen ${ist.slice(0, 12)}…) — Datei verworfen.`,
    );
  }
}

/**
 * tar.gz entpacken. Windows 10+ bringt bsdtar als `tar` mit, Linux GNU tar —
 * beide verstehen `-xzf`. Die Bundles enthalten keine Symlink-Einträge (der
 * Packer externalisiert sie nach uwe-symlinks.json), deshalb braucht das
 * Entpacken keine Sonderrechte.
 */
export function extractTarGz(archiv: string, zielDir: string): void {
  fs.mkdirSync(zielDir, { recursive: true });
  execFileSync("tar", ["-xzf", archiv, "-C", zielDir], { stdio: ["ignore", "ignore", "inherit"] });
}

/**
 * Die vom Packer externalisierten Verzeichnis-Links wiederherstellen. Unter
 * Windows als Directory-Junctions — die brauchen keine Adminrechte und keinen
 * Developer-Mode (pnpm verlinkt seinen Store dort genauso). Ohne diese Links
 * findet Node die Pakete im pnpm-Layout nicht.
 */
export function restoreBundleSymlinks(bundleDir: string): number {
  const datei = path.join(bundleDir, "uwe-symlinks.json");
  if (!fs.existsSync(datei)) return 0;
  const eintraege = JSON.parse(fs.readFileSync(datei, "utf8")) as Array<{ link: string; target: string }>;
  for (const { link, target } of eintraege) {
    const linkAbs = path.join(bundleDir, ...link.split("/"));
    const zielAbs = path.resolve(path.dirname(linkAbs), ...target.split("/"));
    fs.mkdirSync(path.dirname(linkAbs), { recursive: true });
    fs.rmSync(linkAbs, { recursive: true, force: true });
    fs.symlinkSync(zielAbs, linkAbs, process.platform === "win32" ? "junction" : "dir");
  }
  return eintraege.length;
}

/**
 * App-Bundles installieren: je App herunterladen, verifizieren, in ein
 * Staging-Verzeichnis entpacken und erst dann an den endgültigen Ort
 * verschieben. So hinterlässt ein abgebrochener Download nie eine halbe App —
 * entweder liegt die alte Version noch da oder die vollständige neue.
 */
export async function installAppBundles(
  manifest: ReleaseManifestV2,
  apps: readonly HostServiceId[],
  installRoot: string,
  repo: string = UWE_RELEASE_REPO,
): Promise<void> {
  assertRuntimeCompatible(manifest);
  const arbeit = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-install-"));
  try {
    for (const app of apps) {
      const asset = manifest.apps?.[app];
      if (!asset) {
        throw new Error(`Release ${manifest.version} enthält kein Bundle für "${app}".`);
      }
      reportHostStep(`${app}-download`, `${app}: Bundle laden (${Math.round(asset.size / 1024 / 1024)} MB)`);
      const archiv = path.join(arbeit, asset.file);
      await downloadAndVerify(manifest, asset, archiv, repo);

      reportHostStep(`${app}-extract`, `${app}: entpacken`);
      const staging = path.join(arbeit, `staging-${app}`);
      extractTarGz(archiv, staging);
      fs.rmSync(archiv, { force: true });

      const ziel = path.join(installRoot, "apps", app);
      const alt = `${ziel}.alt-${Date.now()}`;
      fs.mkdirSync(path.dirname(ziel), { recursive: true });
      if (fs.existsSync(ziel)) fs.renameSync(ziel, alt);
      try {
        fs.renameSync(staging, ziel);
      } catch {
        // Staging liegt evtl. auf einem anderen Laufwerk als das Ziel — dann
        // kopieren statt umbenennen.
        fs.cpSync(staging, ziel, { recursive: true });
        fs.rmSync(staging, { recursive: true, force: true });
      }
      // Junctions tragen absolute Ziele — sie dürfen erst entstehen, wenn das
      // Bundle an seinem endgültigen Ort liegt, sonst zeigen sie ins
      // (gleich gelöschte) Staging.
      restoreBundleSymlinks(ziel);
      if (fs.existsSync(alt)) fs.rmSync(alt, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(arbeit, { recursive: true, force: true });
  }
}

/**
 * Die vormigrierten, leeren Datenbanken einspielen — ausschließlich beim
 * Erststart. Existiert auch nur eine der Datenbankdateien bereits, wird KEINE
 * angefasst: Bestehende Daten überschreibt dieser Pfad unter keinen Umständen.
 */
export async function installInitialDatabases(
  manifest: ReleaseManifestV2,
  dataDir: string,
  repo: string = UWE_RELEASE_REPO,
): Promise<{ installed: boolean; reason?: string }> {
  const asset = manifest.databases;
  if (!asset) return { installed: false, reason: "Release enthält kein Datenbank-Asset." };

  const namen = ["uwe.db", "uwe-brain.db", "uwe-family.db"];
  const vorhanden = namen.filter((n) => fs.existsSync(path.join(dataDir, n)));
  if (vorhanden.length > 0) {
    return { installed: false, reason: `Bestehende Datenbanken bleiben unangetastet (${vorhanden.join(", ")}).` };
  }

  reportHostStep("databases-download", "Leere Datenbanken laden");
  const arbeit = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-dbs-"));
  try {
    const archiv = path.join(arbeit, asset.file);
    await downloadAndVerify(manifest, asset, archiv, repo);
    extractTarGz(archiv, arbeit);
    fs.mkdirSync(dataDir, { recursive: true });
    for (const n of namen) {
      const quelle = path.join(arbeit, n);
      if (!fs.existsSync(quelle)) throw new Error(`${asset.file} enthält ${n} nicht.`);
      fs.copyFileSync(quelle, path.join(dataDir, n));
    }
  } finally {
    fs.rmSync(arbeit, { recursive: true, force: true });
  }
  return { installed: true };
}
