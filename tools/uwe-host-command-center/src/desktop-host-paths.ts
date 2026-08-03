import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { appendToLog } from "./desktop-host-system.ts";
import type { HostPaths, HostServiceId } from "./desktop-host-types.ts";

/**
 * Wo eine Installation und ihre Laufzeitdaten liegen — Projektordner,
 * Datenverzeichnis, PID-Dateien und der Betriebslog. Bewusst getrennt von
 * `desktop-host.ts`: diese Fragen beantworten auch die CLI, der Tauri-Client
 * und die Port-Übernahme, ohne die ganze Host-Zustandslogik zu laden.
 */

/** Verzeichnisname vor dem Maschinenraum-Rebranding. */
const LEGACY_APP_DIR = "rtx-connector-client";
const APP_DIR = "engine-connector-client";

function vendorRoot(): string {
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "UWE");
  }
  return path.join(os.homedir(), ".local", "share", "UWE");
}

/**
 * Wo Datenbanken, Uploads, Backups und Logs dieser Installation liegen.
 *
 * Vor dem Rebranding hiess das Verzeichnis `rtx-connector-client`. Das Command
 * Center benennt es beim Start einmalig um; die CLI kann aber auch ohne die
 * Desktop-App laufen und wuerde dann neben den Bestandsdaten ein leeres
 * Verzeichnis anlegen. Deshalb hier ein reiner Lese-Rückfall: existiert nur der
 * alte Ort, wird er weiter benutzt. Bewusst kein Umbenennen an dieser Stelle —
 * die Funktion wird auch aufgerufen, waehrend Studio und Portal mit offener
 * `uwe.db` laufen.
 */
export function commandCenterDataRoot(): string {
  const configured = process.env.UWE_COMMAND_CENTER_DATA_DIR?.trim();
  if (configured) return path.resolve(configured);

  const vendor = vendorRoot();
  const current = path.join(vendor, APP_DIR, "host");
  if (fs.existsSync(current)) return current;

  const legacy = path.join(vendor, LEGACY_APP_DIR, "host");
  if (fs.existsSync(legacy)) return legacy;

  return current;
}

export type HostMode = "monorepo" | "bundle";

/**
 * Woraus diese Installation besteht: ein Entwickler-Checkout des Monorepos
 * (pnpm-workspace.yaml vorhanden — Setup/Update laufen über pnpm und git) oder
 * eine Bundle-Installation aus dem Release-Download (entpackte App-Bundles
 * unter apps/<app>/ mit flachem node_modules — kein pnpm, kein git, kein Build).
 */
export function detectHostMode(root: string): HostMode {
  return fs.existsSync(path.join(root, "pnpm-workspace.yaml")) ? "monorepo" : "bundle";
}

/** Standardort einer Bundle-Installation, neben den Host-Daten. */
export function bundleInstallRoot(): string {
  return path.join(commandCenterDataRoot(), "..", "bundle");
}

export function resolveDesktopHostRoot(input?: string): string {
  const configured = input?.trim() || process.env.UWE_MONOREPO_ROOT?.trim();
  if (configured) return path.resolve(configured);

  let current = path.resolve(process.cwd());
  while (true) {
    if (
      fs.existsSync(path.join(current, "pnpm-workspace.yaml")) &&
      fs.existsSync(path.join(current, "apps", "studio")) &&
      fs.existsSync(path.join(current, "apps", "portal"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Kein Checkout gefunden: Wenn am Standardort eine Bundle-Installation liegt
  // (mindestens eine App mit gebautem .next), ist sie das Root. So findet das
  // Command Center eine Installation auch ohne UWE_MONOREPO_ROOT.
  const bundleRoot = bundleInstallRoot();
  if (fs.existsSync(path.join(bundleRoot, "apps"))) {
    return path.resolve(bundleRoot);
  }
  return path.resolve(process.cwd());
}

export function pathsFor(root: string): HostPaths {
  const dataRoot = commandCenterDataRoot();
  return {
    root,
    dataRoot,
    data: path.join(dataRoot, "data"),
    uploads: path.join(dataRoot, "data", "uploads"),
    backups: path.join(dataRoot, "data", "backups"),
    exports: path.join(dataRoot, "exports"),
    logs: path.join(dataRoot, "logs"),
    runtime: path.join(dataRoot, "runtime"),
    envFile: path.join(root, ".env"),
    database: path.join(dataRoot, "data", "uwe.db"),
  };
}

export function ensureHostDirectories(paths: HostPaths): void {
  for (const directory of [
    paths.dataRoot,
    paths.data,
    paths.uploads,
    paths.backups,
    paths.exports,
    paths.logs,
    paths.runtime,
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

export function pidFile(paths: HostPaths, id: HostServiceId): string {
  return path.join(paths.runtime, `${id}.pid`);
}

export function appendOperationLog(paths: HostPaths, line: string): void {
  ensureHostDirectories(paths);
  appendToLog(path.join(paths.logs, "command-center.log"), `[${new Date().toISOString()}] ${line}\n`);
}
