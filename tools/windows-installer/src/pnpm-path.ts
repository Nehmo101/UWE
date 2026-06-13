import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isWindows } from "./paths.js";
import type { CommandResult } from "./types.js";

export interface PnpmPathStatus {
  ok: boolean;
  globalBinDir: string | null;
  inPath: boolean;
  pnpmHome: string | null;
  errors: string[];
  warnings: string[];
}

function commandOutput(command: string): string | null {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: isWindows() ? "cmd.exe" : undefined,
    }).trim();
  } catch {
    return null;
  }
}

export function getPnpmGlobalBinDir(): string | null {
  const fromConfig = commandOutput("pnpm config get global-bin-dir");
  if (fromConfig && fromConfig !== "undefined" && fs.existsSync(fromConfig)) {
    return path.resolve(fromConfig);
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const defaultDir = path.join(localAppData, "pnpm");
    if (fs.existsSync(defaultDir)) {
      return defaultDir;
    }
    return defaultDir;
  }

  return null;
}

export function getPnpmHomeDir(): string | null {
  const fromConfig = commandOutput("pnpm config get global-dir");
  if (fromConfig && fromConfig !== "undefined") {
    return path.resolve(fromConfig);
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    return path.join(localAppData, "pnpm");
  }

  return null;
}

export function isDirectoryInPath(dirPath: string): boolean {
  const normalized = path.resolve(dirPath).toLowerCase();
  const pathEntries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .map((entry) => path.resolve(entry).toLowerCase());

  return pathEntries.includes(normalized);
}

export function checkPnpmPath(): PnpmPathStatus {
  const errors: string[] = [];
  const warnings: string[] = [];
  const globalBinDir = getPnpmGlobalBinDir();
  const pnpmHome = getPnpmHomeDir();

  if (!isWindows()) {
    return {
      ok: true,
      globalBinDir,
      inPath: true,
      pnpmHome,
      errors,
      warnings: ["pnpm PATH check skipped outside Windows."],
    };
  }

  if (!globalBinDir) {
    errors.push(
      "pnpm global bin directory could not be determined. Install pnpm with: corepack enable && corepack prepare pnpm@latest --activate",
    );
    return { ok: false, globalBinDir: null, inPath: false, pnpmHome, errors, warnings };
  }

  const inPath = isDirectoryInPath(globalBinDir);
  if (!inPath) {
    errors.push(
      `The configured global bin directory ${globalBinDir} is not in PATH. UWE can repair this automatically.`,
    );
  }

  return { ok: errors.length === 0, globalBinDir, inPath, pnpmHome, errors, warnings };
}

function getWindowsUserPath(): string {
  if (!isWindows()) {
    return process.env.PATH ?? "";
  }

  try {
    const output = execSync(
      'reg query "HKCU\\Environment" /v Path',
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const match = output.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.+)/i);
    return match?.[1]?.trim() ?? process.env.PATH ?? "";
  } catch {
    return process.env.PATH ?? "";
  }
}

function setWindowsUserPath(newPath: string): void {
  if (!isWindows()) {
    return;
  }

  execSync(
    `setx PATH "${newPath}"`,
    { stdio: "ignore", shell: "cmd.exe" },
  );
}

export function repairPnpmPath(dryRun = false): CommandResult {
  const status = checkPnpmPath();

  if (status.ok) {
    return { ok: true, message: "pnpm PATH is already configured correctly." };
  }

  if (!status.globalBinDir) {
    return {
      ok: false,
      message: status.errors.join("\n"),
    };
  }

  const dirsToAdd: string[] = [status.globalBinDir];
  if (status.pnpmHome && !dirsToAdd.includes(status.pnpmHome)) {
    dirsToAdd.push(status.pnpmHome);
  }

  const currentPath = getWindowsUserPath();
  const pathEntries = currentPath
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  let changed = false;
  for (const dir of dirsToAdd) {
    const normalized = path.resolve(dir);
    const exists = pathEntries.some(
      (entry) => path.resolve(entry).toLowerCase() === normalized.toLowerCase(),
    );
    if (!exists) {
      pathEntries.unshift(normalized);
      changed = true;
    }
  }

  if (!changed) {
    return {
      ok: false,
      message:
        "pnpm directories appear in user PATH but the current process still cannot see them. Please close and reopen your terminal or log out and back in.",
      details: { globalBinDir: status.globalBinDir, needsRestart: true },
    };
  }

  const newPath = pathEntries.join(path.delimiter);

  if (!dryRun && isWindows()) {
    setWindowsUserPath(newPath);
    process.env.PATH = newPath + path.delimiter + (process.env.PATH ?? "");
  }

  return {
    ok: true,
    message: dryRun
      ? `Would add to PATH: ${dirsToAdd.join(", ")}`
      : `Added pnpm directories to user PATH: ${dirsToAdd.join(", ")}. You may need to restart open terminals for all apps to see the change.`,
    details: {
      added: dirsToAdd,
      globalBinDir: status.globalBinDir,
      needsRestart: !dryRun,
    },
  };
}

export function installPnpmViaCorepack(dryRun = false): CommandResult {
  try {
    if (!dryRun) {
      execSync("corepack enable", { stdio: "inherit", shell: isWindows() ? "cmd.exe" : undefined });
      execSync("corepack prepare pnpm@10.12.1 --activate", {
        stdio: "inherit",
        shell: isWindows() ? "cmd.exe" : undefined,
      });
    }

    const pathRepair = repairPnpmPath(dryRun);
    return {
      ok: true,
      message: dryRun
        ? "Would install pnpm via corepack and repair PATH."
        : "pnpm installed via corepack.",
      details: pathRepair.details,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: `Failed to install pnpm: ${message}. Install Node.js 20+ from https://nodejs.org/ first.`,
    };
  }
}

export function getSystemInfo(): Record<string, string> {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    osRelease: os.release(),
    homedir: os.homedir(),
    tempdir: os.tmpdir(),
    user: process.env.USERNAME ?? process.env.USER ?? "unknown",
  };
}
