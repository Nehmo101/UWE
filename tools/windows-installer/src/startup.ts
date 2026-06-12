import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isWindows } from "./paths.js";
import type { CommandResult } from "./types.js";

export function getWindowsStartupFolder(): string | null {
  if (!isWindows()) {
    return null;
  }

  const appData = process.env.APPDATA;
  if (!appData) {
    return null;
  }

  return path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
}

export function getDesktopFolder(): string {
  if (isWindows()) {
    const userProfile = process.env.USERPROFILE;
    if (userProfile) {
      return path.join(userProfile, "Desktop");
    }
  }

  return path.join(os.homedir(), "Desktop");
}

export function getStartMenuProgramsFolder(): string | null {
  if (!isWindows()) {
    return null;
  }

  const appData = process.env.APPDATA;
  if (!appData) {
    return null;
  }

  return path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs");
}

export function buildShortcutScript(
  targetScript: string,
  installRoot: string,
  action = "start",
): string {
  return [
    "@echo off",
    `cd /d "${installRoot}"`,
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${targetScript}" -Action ${action} -InstallRoot "${installRoot}"`,
    "",
  ].join("\r\n");
}

export function enableAutoStart(
  installRoot: string,
  launcherScript: string,
  dryRun = false,
): CommandResult {
  const startupFolder = getWindowsStartupFolder();
  if (!startupFolder) {
    return {
      ok: false,
      message: "Windows Startup folder not available on this platform.",
    };
  }

  const shortcutPath = path.join(startupFolder, "UWE-Autostart.cmd");
  const content = buildShortcutScript(launcherScript, installRoot);

  if (!dryRun) {
    fs.mkdirSync(startupFolder, { recursive: true });
    fs.writeFileSync(shortcutPath, content, "utf8");
  }

  return {
    ok: true,
    message: `Auto-start enabled: ${shortcutPath}`,
    details: { shortcutPath },
  };
}

export function disableAutoStart(dryRun = false): CommandResult {
  const startupFolder = getWindowsStartupFolder();
  if (!startupFolder) {
    return {
      ok: false,
      message: "Windows Startup folder not available on this platform.",
    };
  }

  const shortcutPath = path.join(startupFolder, "UWE-Autostart.cmd");
  if (fs.existsSync(shortcutPath) && !dryRun) {
    fs.unlinkSync(shortcutPath);
  }

  return {
    ok: true,
    message: fs.existsSync(shortcutPath)
      ? `Auto-start entry still present: ${shortcutPath}`
      : "Auto-start disabled.",
    details: { shortcutPath },
  };
}

export function createDesktopShortcut(
  installRoot: string,
  launcherScript: string,
  dryRun = false,
): CommandResult {
  const desktop = getDesktopFolder();
  const shortcutPath = path.join(desktop, "UWE Launcher.cmd");
  const content = buildShortcutScript(launcherScript, installRoot);

  if (!dryRun) {
    fs.writeFileSync(shortcutPath, content, "utf8");
  }

  return {
    ok: true,
    message: `Desktop shortcut created: ${shortcutPath}`,
    details: { shortcutPath },
  };
}

export function createStartMenuShortcut(
  installRoot: string,
  launcherScript: string,
  dryRun = false,
): CommandResult {
  const programs = getStartMenuProgramsFolder();
  if (!programs) {
    return { ok: false, message: "Start Menu folder not available." };
  }

  const uweFolder = path.join(programs, "UWE");
  const shortcutPath = path.join(uweFolder, "UWE Launcher.cmd");
  const content = buildShortcutScript(launcherScript, installRoot);

  if (!dryRun) {
    fs.mkdirSync(uweFolder, { recursive: true });
    fs.writeFileSync(shortcutPath, content, "utf8");
  }

  return {
    ok: true,
    message: `Start Menu shortcut created: ${shortcutPath}`,
    details: { shortcutPath },
  };
}
