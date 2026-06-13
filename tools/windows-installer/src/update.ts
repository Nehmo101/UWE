import fs from "node:fs";
import path from "node:path";

import { createDataSnapshot } from "./backup-restore.js";
import { installUwe } from "./install.js";
import { appendInstallLog } from "./logging.js";
import { resolveInstallPaths } from "./paths.js";
import { readInstallerState, writeInstallerState } from "./state.js";
import type { CommandResult, InstallMode } from "./types.js";

export interface UpdateOptions {
  installRoot: string;
  bundlePath?: string;
  repoPath?: string;
  dryRun?: boolean;
}

function readVersionFromApp(appRoot: string): string | null {
  const versionFile = path.join(appRoot, "VERSION");
  if (fs.existsSync(versionFile)) {
    return fs.readFileSync(versionFile, "utf8").trim();
  }

  const pkgFile = path.join(appRoot, "package.json");
  if (fs.existsSync(pkgFile)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8")) as { version?: string };
      return pkg.version ?? null;
    } catch {
      return null;
    }
  }

  return null;
}

export function getInstalledVersion(installRoot: string): string | null {
  const paths = resolveInstallPaths(installRoot);
  const state = readInstallerState(paths.stateFile);
  if (state?.uweVersion) {
    return state.uweVersion;
  }

  return readVersionFromApp(paths.app);
}

export function getAvailableVersion(sourcePath: string): string | null {
  return readVersionFromApp(sourcePath);
}

export interface UpdateCheckResult {
  installedVersion: string | null;
  availableVersion: string | null;
  updateAvailable: boolean;
}

export function checkForUpdate(
  installRoot: string,
  sourcePath: string,
): UpdateCheckResult {
  const installedVersion = getInstalledVersion(installRoot);
  const availableVersion = getAvailableVersion(sourcePath);

  return {
    installedVersion,
    availableVersion,
    updateAvailable: Boolean(
      installedVersion &&
        availableVersion &&
        installedVersion !== availableVersion,
    ),
  };
}

export async function runUpdate(options: UpdateOptions): Promise<CommandResult> {
  const paths = resolveInstallPaths(options.installRoot);
  const state = readInstallerState(paths.stateFile);

  if (!state) {
    return { ok: false, message: "UWE is not installed. Run install first." };
  }

  const mode: InstallMode = state.mode;
  const sourcePath =
    options.bundlePath ??
    options.repoPath ??
    state.bundlePath ??
    state.repoPath;

  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return {
      ok: false,
      message: "Update source not found. Provide --bundle or --repo.",
    };
  }

  const check = checkForUpdate(options.installRoot, sourcePath);
  appendInstallLog(
    paths.logs,
    `Update check: installed=${check.installedVersion ?? "unknown"}, available=${check.availableVersion ?? "unknown"}`,
  );

  if (!options.dryRun && !check.updateAvailable && check.installedVersion && check.availableVersion) {
    return {
      ok: true,
      message: `UWE is already up to date (${check.installedVersion}).`,
      details: check as unknown as Record<string, unknown>,
    };
  }

  const snapshot = createDataSnapshot(options.installRoot, options.dryRun);
  appendInstallLog(paths.logs, snapshot.message);

  const installResult = await installUwe({
    installRoot: options.installRoot,
    mode,
    bundlePath: mode === "release" ? sourcePath : undefined,
    repoPath: mode === "dev" ? sourcePath : undefined,
    dryRun: options.dryRun,
    upgrade: true,
    seedDemo: false,
  });

  if (!installResult.ok) {
    return {
      ok: false,
      message: `Update failed: ${installResult.message}. Pre-update snapshot: ${snapshot.message}`,
      details: { snapshot: snapshot.details, check },
    };
  }

  if (!options.dryRun) {
    const newVersion = getAvailableVersion(sourcePath);
    writeInstallerState(paths.stateFile, {
      ...state,
      uweVersion: newVersion ?? state.uweVersion,
      installedAt: new Date().toISOString(),
    });
  }

  appendInstallLog(paths.logs, `Update completed to ${check.availableVersion ?? "latest"}`);

  return {
    ok: true,
    message: options.dryRun
      ? `Update dry-run planned: ${check.installedVersion} -> ${check.availableVersion}`
      : `Update completed: ${check.installedVersion} -> ${check.availableVersion}`,
    details: { snapshot: snapshot.details, check },
  };
}
