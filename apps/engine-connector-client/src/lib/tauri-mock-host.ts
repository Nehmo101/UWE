import type {
  LocalHostActionResult,
  LocalHostInstallSelection,
  LocalHostServiceId,
  LocalHostStatus,
  LocalHostUpdateInfo,
} from "./tauri-types";

/**
 * App-Auswahl der Browser-Vorschau. Sie lebt im Modul-Scope, damit
 * `set_install_selection` im Mock genauso „hängen bleibt" wie die echte Datei
 * auf dem Host — sonst könnte der Assistent nicht durchgespielt werden.
 */
let mockSelection: LocalHostInstallSelection | null = null;

const MOCK_SERVICES: ReadonlyArray<{ id: LocalHostServiceId; label: string; port: number }> = [
  { id: "studio", label: "UWE Studio", port: 3000 },
  { id: "portal", label: "UWE Portal", port: 3001 },
  { id: "brain", label: "UWE Brain", port: 3102 },
  { id: "family", label: "UWE Family", port: 3004 },
  { id: "landing", label: "UWE Startseite", port: 3103 },
];

export function readMockInstallSelection(): { selection: LocalHostInstallSelection; persisted: boolean } {
  return {
    selection: mockSelection ?? {
      version: 1,
      apps: ["studio", "portal", "brain", "family", "landing"],
      ports: {},
      seedDemoContent: true,
      updatedAt: null,
    },
    persisted: mockSelection !== null,
  };
}

export function writeMockInstallSelection(input: unknown): LocalHostInstallSelection {
  const record = (input ?? {}) as Partial<LocalHostInstallSelection>;
  const apps = Array.isArray(record.apps) && record.apps.length > 0
    ? (record.apps as LocalHostServiceId[])
    : readMockInstallSelection().selection.apps;
  mockSelection = {
    version: 1,
    apps,
    ports: record.ports ?? {},
    seedDemoContent: record.seedDemoContent !== false,
    updatedAt: new Date().toISOString(),
  };
  return mockSelection;
}

export function buildMockHostStatus(running = false): LocalHostStatus {
  const { selection, persisted } = readMockInstallSelection();
  return {
    collectedAt: new Date().toISOString(),
    overall: running ? "ready" : "attention",
    root: "C:\\git\\UWE",
    revision: "preview",
    branch: "main",
    longRun: null,
    installation: {
      repoReady: true,
      dependenciesReady: true,
      envReady: true,
      databaseReady: true,
      buildReady: true,
      apps: selection.apps,
      selectionPersisted: persisted,
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
      name: "NVIDIA Maschinenraum (Vorschau)",
      vramTotalMb: 12288,
      utilizationPercent: 18,
      temperatureC: 48,
    },
    services: MOCK_SERVICES.filter((service) => selection.apps.includes(service.id)).map(
      ({ id, label, port }) => ({
        id,
        label,
        state: running ? ("online" as const) : ("stopped" as const),
        healthy: running,
        pid: running ? port : null,
        url: `http://127.0.0.1:${port}`,
        message: running ? "Erreichbar" : "Gestoppt",
      }),
    ),
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
