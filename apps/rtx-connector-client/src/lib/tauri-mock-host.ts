import type { LocalHostActionResult, LocalHostStatus, LocalHostUpdateInfo } from "./tauri-types";

export function buildMockHostStatus(running = false): LocalHostStatus {
  return {
    collectedAt: new Date().toISOString(),
    overall: running ? "ready" : "attention",
    root: "C:\\git\\UWE",
    revision: "preview",
    branch: "main",
    installation: {
      repoReady: true,
      dependenciesReady: true,
      envReady: true,
      databaseReady: true,
      buildReady: true,
      message: "Browser-Vorschau: UWE ist eingerichtet.",
    },
    host: {
      hostname: "uwe-preview",
      platform: "browser",
      release: "preview",
      uptimeSeconds: 86400,
      cpuModel: "Browser-Vorschau",
      cpuCores: 8,
      ramTotalBytes: 32 * 1024 ** 3,
      ramUsedBytes: 12 * 1024 ** 3,
      diskTotalBytes: 1024 ** 4,
      diskUsedBytes: 320 * 1024 ** 3,
    },
    gpu: {
      available: true,
      name: "NVIDIA RTX (Vorschau)",
      vramTotalMb: 12288,
      utilizationPercent: 18,
      temperatureC: 48,
    },
    services: [
      { id: "studio", label: "UWE Studio", state: running ? "online" : "stopped", healthy: running, pid: running ? 3000 : null, url: "http://127.0.0.1:3000", message: running ? "Erreichbar" : "Gestoppt" },
      { id: "portal", label: "UWE Portal", state: running ? "online" : "stopped", healthy: running, pid: running ? 3001 : null, url: "http://127.0.0.1:3001", message: running ? "Erreichbar" : "Gestoppt" },
    ],
    dataDir: "C:\\Users\\UWE\\AppData\\Local\\UWE\\command-center\\data",
    logsDir: "C:\\Users\\UWE\\AppData\\Local\\UWE\\command-center\\logs",
  };
}

export function buildMockHostAction(message: string, running = false): LocalHostActionResult {
  return { ok: true, message, status: buildMockHostStatus(running) };
}

export function buildMockHostUpdate(updateAvailable = false): LocalHostUpdateInfo {
  const status = buildMockHostStatus(false);
  return {
    ok: true,
    updateAvailable,
    currentVersion: "0.1.0",
    currentRevision: "preview",
    latestVersion: updateAvailable ? "0.1.1" : "0.1.0",
    latestTag: updateAvailable ? "uwe-v0.1.1" : "uwe-v0.1.0",
    latestRevision: updateAvailable ? "next" : "preview",
    releaseUrl: "https://github.com/Nehmo101/UWE/releases/tag/uwe-v0.1.0",
    windowsInstallerUrl:
      "https://github.com/Nehmo101/UWE/releases/download/uwe-v0.1.0/UWE_Command_Center_0.1.0_x64-setup.exe",
    commandCenterUpdateAvailable: updateAvailable,
    dirtyWorktree: false,
    message: updateAvailable
      ? "Browser-Vorschau: Update verfügbar (uwe-v0.1.1)."
      : "Browser-Vorschau: UWE ist aktuell.",
    status,
  };
}
