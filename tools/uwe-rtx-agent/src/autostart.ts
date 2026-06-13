import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { appendAgentLog } from "./logging.js";
import { getAgentRoot, getWindowsStartupFolder, isWindows } from "./paths.js";

const REGISTRY_RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const AUTOSTART_VALUE_NAME = "UWE-RTX-Agent";
const STARTUP_SHORTCUT_NAME = "UWE-RTX-Agent-Autostart.cmd";

export interface AutostartStatus {
  enabled: boolean;
  method?: "registry" | "startup-folder";
  target?: string;
}

function getTrayScriptPath(): string {
  return path.join(getAgentRoot(), "scripts", "rtx-tray.ps1");
}

function buildTrayLaunchCommand(): string {
  const trayScript = getTrayScriptPath();
  return `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${trayScript}"`;
}

function readRegistryAutostartTarget(): string | null {
  if (!isWindows()) {
    return null;
  }

  try {
    const output = runPowerShell(
      `$value = Get-ItemProperty -Path 'Registry::${REGISTRY_RUN_KEY}' -Name '${AUTOSTART_VALUE_NAME}' -ErrorAction SilentlyContinue; if ($null -ne $value) { $value.'${AUTOSTART_VALUE_NAME}' }`,
    );
    const trimmed = output.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

function getStartupShortcutPath(): string | null {
  const startupFolder = getWindowsStartupFolder();
  if (!startupFolder) {
    return null;
  }
  return path.join(startupFolder, STARTUP_SHORTCUT_NAME);
}

function readStartupFolderAutostartTarget(): string | null {
  const shortcutPath = getStartupShortcutPath();
  if (!shortcutPath || !fs.existsSync(shortcutPath)) {
    return null;
  }
  return fs.readFileSync(shortcutPath, "utf8");
}

export function getAutostartStatus(): AutostartStatus {
  const registryTarget = readRegistryAutostartTarget();
  if (registryTarget) {
    return {
      enabled: true,
      method: "registry",
      target: registryTarget,
    };
  }

  const startupContent = readStartupFolderAutostartTarget();
  if (startupContent) {
    return {
      enabled: true,
      method: "startup-folder",
      target: startupContent.trim(),
    };
  }

  return { enabled: false };
}

export function enableAutostart(): AutostartStatus {
  if (!isWindows()) {
    throw new Error("Autostart is only supported on Windows.");
  }

  const launchCommand = buildTrayLaunchCommand();
  runPowerShell(
    `New-ItemProperty -Path 'Registry::${REGISTRY_RUN_KEY}' -Name '${AUTOSTART_VALUE_NAME}' -Value '${escapePowerShellSingleQuoted(launchCommand)}' -PropertyType String -Force | Out-Null`,
  );

  appendAgentLog("Autostart enabled via CurrentUser registry.");
  return getAutostartStatus();
}

export function disableAutostart(): AutostartStatus {
  if (!isWindows()) {
    throw new Error("Autostart is only supported on Windows.");
  }

  runPowerShell(
    `Remove-ItemProperty -Path 'Registry::${REGISTRY_RUN_KEY}' -Name '${AUTOSTART_VALUE_NAME}' -ErrorAction SilentlyContinue`,
  );

  const shortcutPath = getStartupShortcutPath();
  if (shortcutPath && fs.existsSync(shortcutPath)) {
    fs.unlinkSync(shortcutPath);
  }

  appendAgentLog("Autostart disabled.");
  return getAutostartStatus();
}

export function enableStartupFolderAutostart(): AutostartStatus {
  const startupFolder = getWindowsStartupFolder();
  if (!startupFolder) {
    throw new Error("Windows Startup folder not available.");
  }

  const shortcutPath = path.join(startupFolder, STARTUP_SHORTCUT_NAME);
  const launchCommand = buildTrayLaunchCommand();
  const content = ["@echo off", launchCommand, ""].join("\r\n");
  fs.mkdirSync(startupFolder, { recursive: true });
  fs.writeFileSync(shortcutPath, content, "utf8");

  appendAgentLog(`Autostart enabled via Startup folder: ${shortcutPath}`);
  return getAutostartStatus();
}

function runPowerShell(script: string): string {
  return execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { encoding: "utf8" },
  ).toString();
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}
