import fs from "node:fs";
import path from "node:path";

import { readInstallerState } from "./state.js";
import { resolveInstallPaths } from "./paths.js";
import type { InstallPaths } from "./types.js";

export interface ExistingInstallInfo {
  installed: boolean;
  installRoot: string;
  paths: InstallPaths;
  hasDatabase: boolean;
  hasUploads: boolean;
  hasBackups: boolean;
  hasEnv: boolean;
  hasApp: boolean;
  mode?: string;
  installedAt?: string;
  uweVersion?: string;
}

function directoryHasFiles(dirPath: string): boolean {
  if (!fs.existsSync(dirPath)) {
    return false;
  }

  try {
    const entries = fs.readdirSync(dirPath);
    return entries.some((entry) => !entry.startsWith("."));
  } catch {
    return false;
  }
}

export function detectExistingInstall(installRoot: string): ExistingInstallInfo {
  const paths = resolveInstallPaths(installRoot);
  const state = readInstallerState(paths.stateFile);

  let uweVersion: string | undefined;
  const versionFile = path.join(paths.app, "VERSION");
  if (fs.existsSync(versionFile)) {
    uweVersion = fs.readFileSync(versionFile, "utf8").trim();
  }

  const hasDatabase = fs.existsSync(path.join(paths.data, "uwe.db"));
  const hasUploads = directoryHasFiles(paths.uploads);
  const hasBackups = directoryHasFiles(paths.backups);
  const hasEnv = fs.existsSync(paths.envFile);
  const hasApp = fs.existsSync(path.join(paths.app, "package.json"));

  const installed = Boolean(state) || hasApp || hasDatabase || hasEnv;

  return {
    installed,
    installRoot: paths.root,
    paths,
    hasDatabase,
    hasUploads,
    hasBackups,
    hasEnv,
    hasApp,
    mode: state?.mode,
    installedAt: state?.installedAt,
    uweVersion: state?.uweVersion ?? uweVersion,
  };
}

export function describeExistingInstall(info: ExistingInstallInfo): string[] {
  const lines: string[] = [];

  if (!info.installed) {
    lines.push("No existing UWE installation detected.");
    return lines;
  }

  lines.push(`Existing installation found at: ${info.installRoot}`);

  if (info.uweVersion) {
    lines.push(`Version: ${info.uweVersion}`);
  }

  if (info.installedAt) {
    lines.push(`Installed at: ${info.installedAt}`);
  }

  if (info.hasDatabase) {
    lines.push("Database: present");
  }

  if (info.hasUploads) {
    lines.push("Uploads: present");
  }

  if (info.hasBackups) {
    lines.push("Backups: present");
  }

  if (info.hasEnv) {
    lines.push("Configuration (.env): present");
  }

  return lines;
}
