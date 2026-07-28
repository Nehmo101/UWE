/**
 * Datenformen und Dienst-Registry des lokalen UWE-Hosts.
 *
 * Bewusst frei von Laufzeitlogik und Node-Abhängigkeiten (außer Typen): sowohl
 * `desktop-host.ts` als auch der Tauri-Client und die CLI hängen an diesen
 * Formen, und `desktop-host.ts` re-exportiert sie für Bestandsimporte.
 */

export type ServiceState = "online" | "starting" | "stopped" | "error";

/**
 * Vom Host verwaltete Dienste. „landing" ist die öffentliche Startseite auf dem
 * Apex-Origin (uwe.example) — ein eigener Prozess, damit die Hauptdomain
 * keinen Studio-Code ausliefert. Die Reihenfolge hier ist zugleich die Start-
 * und Anzeigereihenfolge im Command Center.
 */
export const HOST_SERVICE_IDS = ["studio", "portal", "brain", "landing"] as const;

export type HostServiceId = (typeof HOST_SERVICE_IDS)[number];

export function isHostServiceId(value: unknown): value is HostServiceId {
  return typeof value === "string" && (HOST_SERVICE_IDS as readonly string[]).includes(value);
}

export interface DesktopHostService {
  id: HostServiceId;
  label: string;
  state: ServiceState;
  healthy: boolean;
  pid: number | null;
  url: string;
  message: string;
}

export interface DesktopHostStatus {
  collectedAt: string;
  overall: "ready" | "attention" | "error";
  root: string;
  revision: string | null;
  branch: string | null;
  installation: {
    repoReady: boolean;
    dependenciesReady: boolean;
    envReady: boolean;
    databaseReady: boolean;
    buildReady: boolean;
    message: string;
  };
  host: {
    hostname: string;
    platform: string;
    release: string;
    uptimeSeconds: number;
    cpuModel: string;
    cpuCores: number;
    ramTotalBytes: number;
    ramUsedBytes: number;
    diskTotalBytes: number | null;
    diskUsedBytes: number | null;
  };
  gpu: {
    available: boolean;
    name: string | null;
    vramTotalMb: number | null;
    utilizationPercent: number | null;
    temperatureC: number | null;
  };
  services: DesktopHostService[];
  dataDir: string;
  logsDir: string;
}

export interface DesktopHostActionResult {
  ok: boolean;
  message: string;
  status: DesktopHostStatus;
}

export interface HostPaths {
  root: string;
  dataRoot: string;
  data: string;
  uploads: string;
  backups: string;
  exports: string;
  logs: string;
  runtime: string;
  envFile: string;
  database: string;
}

export interface ServiceDefinition {
  id: HostServiceId;
  label: string;
  port: number;
}

export interface HostBackupEntry {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

/** Gültiger Port oder Rückfallwert — schützt vor Tippfehlern in der `.env`. */
export function parseServicePort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : fallback;
}
