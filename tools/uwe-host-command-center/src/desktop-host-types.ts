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
 * keinen Studio-Code ausliefert. „family" ist der gemeinsame Haushaltsbereich
 * (Häkchen `Family`). Die Reihenfolge hier ist zugleich die Start- und
 * Anzeigereihenfolge im Command Center.
 */
export const HOST_SERVICE_IDS = ["studio", "portal", "brain", "family", "landing"] as const;

export type HostServiceId = (typeof HOST_SERVICE_IDS)[number];

/** Anzeigename je Dienst — eine Quelle für Statuskarten, Logs und Einrichtungsplan. */
export const HOST_SERVICE_LABELS: Record<HostServiceId, string> = {
  studio: "UWE Studio",
  portal: "UWE Portal",
  brain: "UWE Brain",
  family: "UWE Family",
  landing: "UWE Startseite",
};

/**
 * Selbstauskunft der Apps in `/api/health` (Feld `app` bzw. `app.name`). Nur
 * die Startseite weicht vom Anzeigenamen ab: „UWE Startseite" steht in der
 * Oberfläche, „UWE Landing" nennt die App selbst.
 *
 * Daran unterscheidet das Command Center einen **eigenen verwaisten Prozess**
 * (frühere Sitzung, PID-Datei verloren) von einem **wirklich fremden Dienst**
 * auf demselben Port — ohne diese Unterscheidung blockiert jede eigene Leiche
 * den Start dauerhaft, weil sie über keinen Knopf mehr erreichbar ist.
 */
export const HOST_SERVICE_HEALTH_APPS: Record<HostServiceId, string> = {
  studio: "UWE Studio",
  portal: "UWE Portal",
  brain: "UWE Brain",
  family: "UWE Family",
  landing: "UWE Landing",
};

/** Weist sich der Dienst auf einem belegten Port als genau diese App aus? */
export function isOwnServiceApp(id: HostServiceId, app: string | null): boolean {
  return app !== null && app === HOST_SERVICE_HEALTH_APPS[id];
}

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
    /** Installierte Apps laut Auswahl des Ersteinrichtungs-Assistenten. */
    apps: HostServiceId[];
    /**
     * `false`, solange der Assistent nie gelaufen ist. Zusammen mit
     * `buildReady` entscheidet das Command Center daraus, ob der
     * Ersteinrichtungs-Assistent beim Start aufgehen soll.
     */
    selectionPersisted: boolean;
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
