import fs from "node:fs";
import path from "node:path";

import { appendInstallLog } from "./logging.js";
import {
  disableAutoStart,
  getDesktopFolder,
  getStartMenuProgramsFolder,
  getWindowsStartupFolder,
} from "./startup.js";
import { stopUwe } from "./launcher.js";
import { resolveInstallPaths } from "./paths.js";
import type { CommandResult } from "./types.js";

export interface UninstallOptions {
  installRoot: string;
  keepData?: boolean;
  dryRun?: boolean;
}

function removeIfExists(targetPath: string, dryRun: boolean): boolean {
  if (!fs.existsSync(targetPath)) {
    return false;
  }

  if (!dryRun) {
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
  }

  return true;
}

export async function uninstallUwe(options: UninstallOptions): Promise<CommandResult> {
  const paths = resolveInstallPaths(options.installRoot);
  const keepData = options.keepData ?? false;
  const dryRun = options.dryRun ?? false;
  const removed: string[] = [];

  appendInstallLog(paths.logs, `Uninstall started (keepData=${keepData}, dryRun=${dryRun})`);

  stopUwe(paths.stateFile);
  disableAutoStart(dryRun);

  const desktopShortcut = path.join(getDesktopFolder(), "UWE starten.cmd");
  if (removeIfExists(desktopShortcut, dryRun)) {
    removed.push(desktopShortcut);
  }

  const legacyDesktopShortcut = path.join(getDesktopFolder(), "UWE Launcher.cmd");
  if (removeIfExists(legacyDesktopShortcut, dryRun)) {
    removed.push(legacyDesktopShortcut);
  }

  const startMenuFolder = getStartMenuProgramsFolder();
  if (startMenuFolder) {
    const uweMenu = path.join(startMenuFolder, "UWE");
    if (removeIfExists(uweMenu, dryRun)) {
      removed.push(uweMenu);
    }
  }

  const startupFolder = getWindowsStartupFolder();
  if (startupFolder) {
    const autostart = path.join(startupFolder, "UWE-Autostart.cmd");
    if (removeIfExists(autostart, dryRun)) {
      removed.push(autostart);
    }
  }

  const controlPanelShortcut = path.join(getDesktopFolder(), "UWE Steuerung.cmd");
  if (removeIfExists(controlPanelShortcut, dryRun)) {
    removed.push(controlPanelShortcut);
  }

  if (keepData) {
    if (removeIfExists(paths.app, dryRun)) {
      removed.push(paths.app);
    }
    if (removeIfExists(paths.config, dryRun)) {
      removed.push(paths.config);
    }
    if (removeIfExists(paths.logs, dryRun)) {
      removed.push(paths.logs);
    }
    if (removeIfExists(paths.exports, dryRun)) {
      removed.push(paths.exports);
    }
  } else if (removeIfExists(paths.root, dryRun)) {
    removed.push(paths.root);
  }

  const message = keepData
    ? dryRun
      ? `Would uninstall UWE app files but keep data in ${paths.data}`
      : `UWE uninstalled. Your data was kept in ${paths.data}`
    : dryRun
      ? `Would completely remove ${paths.root}`
      : `UWE completely removed from ${paths.root}`;

  appendInstallLog(paths.logs, message);

  return {
    ok: true,
    message,
    details: { removed, keepData },
  };
}
