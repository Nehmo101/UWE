import type { SystemStatus } from "./system-status";
import type { RtxExposureAssessment, StudioSecurityAssessment } from "./studio-security";
import { countOpenSetupSteps, type HardwareUrlWarning } from "./hardware-utils";
import type { UserRoleCounts } from "./security-dashboard";

export type HomelabServiceId =
  | "uwe_studio"
  | "portal"
  | "database"
  | "cloudflare_tunnel"
  | "rtx_agent"
  | "ollama"
  | "backup";

export type HomelabSeverity = "ok" | "warn" | "error" | "unknown";

export interface HomelabServiceStatus {
  id: HomelabServiceId;
  label: string;
  ok: boolean;
  severity: HomelabSeverity;
  message: string;
}

export interface HomelabRunbookStep {
  order: number;
  instruction: string;
  command?: string;
}

export interface HomelabRunbook {
  id: string;
  title: string;
  summary: string;
  steps: HomelabRunbookStep[];
}

export interface HomelabSecurityCheckItem {
  id: string;
  label: string;
  ok: boolean;
  severity: HomelabSeverity;
  message: string;
  manual: boolean;
}

export interface HardwareErrorEntry {
  id: string;
  problem: string;
  occurredAt: string;
  resolution?: string;
  affectedServices?: string[];
}

export interface HardwareDeviceCardView {
  id: string;
  name: string;
  role: string;
  status: string;
  hostname: string | null;
  ipAddress: string | null;
  localUrl: string | null;
  publicUrl: string | null;
  operatingSystem: string;
  specsLines: string[];
  services: string[];
  lastCheckedAt: string | null;
  openSetupSteps: number;
  setupSteps: Array<{ label: string; done: boolean }>;
  errorHistory: HardwareErrorEntry[];
  notes: string;
  errorNotes: string | null;
}

export interface HomelabHealthInput {
  system: SystemStatus;
  studioSecurity: StudioSecurityAssessment;
  rtxExposure: RtxExposureAssessment;
  rtx: {
    ready: boolean;
    online: boolean;
    message: string;
    urlAllowed: boolean;
    source: string;
  };
  inference: {
    enabled: boolean;
    online: boolean;
    message: string;
    provider: string;
  };
  backup: {
    writable: boolean;
    count: number;
    lastAt: string | null;
    message: string;
  };
  portalProbe?: { ok: boolean; message: string };
  timestamp: string;
}

function severityFromOk(ok: boolean, warnWhenFalse = false): HomelabSeverity {
  if (ok) return "ok";
  return warnWhenFalse ? "warn" : "error";
}

export function buildHomelabServiceStatuses(input: HomelabHealthInput): HomelabServiceStatus[] {
  const { system, studioSecurity, rtxExposure, rtx, inference, backup, portalProbe } = input;

  const studioOk = system.ok && system.app.ok;
  const portalOk = portalProbe?.ok ?? false;
  const portalSeverity: HomelabSeverity = portalProbe
    ? portalOk
      ? "ok"
      : "error"
    : "unknown";

  const dbOk = system.database.ok && system.migrations.ok;
  const dbMessage = !system.database.ok
    ? system.database.message
    : !system.migrations.ok
      ? `Migrationen: ${system.migrations.message}`
      : "Datenbank und Migrationen OK";

  const publicExposure = studioSecurity.publicExposureConfigured;
  const tunnelConfigured = system.proxy.cloudflareTunnel && system.proxy.trustProxy;
  const tunnelOk = !publicExposure || tunnelConfigured;
  const tunnelMessage = !publicExposure
    ? "Nur lokal — Cloudflare Tunnel nicht erforderlich"
    : tunnelConfigured
      ? "Cloudflare Tunnel + TRUST_PROXY aktiv"
      : "Öffentliche Erreichbarkeit ohne Tunnel/TRUST_PROXY-Konfiguration";

  const rtxAgentConfigured =
    rtx.source === "agent" ||
    rtxExposure.endpoints.some((entry) => entry.envKey === "RTX_AGENT_URL" && entry.configured);
  const rtxAgentOk =
    !inference.enabled || !rtxAgentConfigured
      ? !rtxAgentConfigured && !inference.enabled
      : rtx.urlAllowed && rtx.ready;
  const rtxAgentSeverity: HomelabSeverity = !inference.enabled
    ? "unknown"
    : !rtxAgentConfigured
      ? "warn"
      : rtxAgentOk
        ? "ok"
        : "error";

  const ollamaOk = inference.enabled && inference.online && inference.provider.includes("ollama");
  const ollamaSeverity: HomelabSeverity = !inference.enabled
    ? "unknown"
    : ollamaOk
      ? "ok"
      : rtx.ready
        ? "warn"
        : "error";

  const backupOk = backup.writable && backup.count > 0;
  const backupSeverity: HomelabSeverity = !backup.writable
    ? "error"
    : backup.count === 0
      ? "warn"
      : "ok";

  return [
    {
      id: "uwe_studio",
      label: "UWE Studio",
      ok: studioOk,
      severity: severityFromOk(studioOk),
      message: studioOk ? "Studio läuft" : "Studio-Systemstatus meldet Probleme",
    },
    {
      id: "portal",
      label: "Portal",
      ok: portalOk,
      severity: portalSeverity,
      message: portalProbe?.message ?? "Portal nicht live geprüft — URL in NEXT_PUBLIC_PORTAL_URL",
    },
    {
      id: "database",
      label: "Datenbank",
      ok: dbOk,
      severity: severityFromOk(dbOk),
      message: dbMessage,
    },
    {
      id: "cloudflare_tunnel",
      label: "Cloudflare Tunnel",
      ok: tunnelOk,
      severity: publicExposure && !tunnelConfigured ? "error" : tunnelOk ? "ok" : "warn",
      message: tunnelMessage,
    },
    {
      id: "rtx_agent",
      label: "RTX Agent (Legacy)",
      ok: rtxAgentOk,
      severity: rtxAgentSeverity,
      message: !inference.enabled
        ? "KI deaktiviert — Legacy RTX Agent optional (outbound Connector bevorzugt)"
        : !rtxAgentConfigured
          ? "RTX_AGENT_URL nicht konfiguriert"
          : !rtx.urlAllowed
            ? "RTX-Agent-URL ist nicht LAN-only — niemals öffentlich exposen"
            : rtx.ready
              ? rtx.message
              : rtx.message || "RTX Agent nicht erreichbar",
    },
    {
      id: "ollama",
      label: "Ollama / Local AI",
      ok: ollamaOk || (inference.enabled && rtx.ready),
      severity: ollamaSeverity,
      message: !inference.enabled
        ? "Lokale KI deaktiviert"
        : ollamaOk
          ? inference.message
          : rtx.ready
            ? "Inference über RTX Agent bereit"
            : inference.message || "Ollama/Inference offline",
    },
    {
      id: "backup",
      label: "Backup",
      ok: backupOk,
      severity: backupSeverity,
      message: backup.message,
    },
  ];
}

export function buildHomelabRunbooks(): HomelabRunbook[] {
  return [
    {
      id: "after_reboot",
      title: "Nach Neustart",
      summary: "Reihenfolge nach Host- oder RTX-Neustart im Homelab.",
      steps: [
        {
          order: 1,
          instruction: "Host-Laptop: Netzwerk und SSH prüfen",
          command: "ping <host-ip> && ssh <user>@<host-ip> 'uptime'",
        },
        {
          order: 2,
          instruction: "UWE starten (Linux Host)",
          command: "./scripts/uwe-host-start.sh",
        },
        {
          order: 3,
          instruction: "RTX-Rechner: Ollama + outbound RTX Host Connector starten (Legacy inbound RTX Agent ist deprecated)",
        },
        {
          order: 4,
          instruction: "Cloudflare Tunnel starten (falls öffentlich)",
          command: "cloudflared tunnel run <tunnel-name>",
        },
        {
          order: 5,
          instruction: "Studio /today und /hardware öffnen — System-Ampel muss grün sein",
        },
      ],
    },
    {
      id: "start_uwe",
      title: "UWE starten",
      summary: "Studio und Portal auf dem Host-Laptop hochfahren.",
      steps: [
        { order: 1, instruction: "In Repo-Verzeichnis wechseln", command: "cd /path/to/uwe" },
        {
          order: 2,
          instruction: "Host-Startskript ausführen",
          command: "./scripts/uwe-host-start.sh",
        },
        {
          order: 3,
          instruction: "Health prüfen",
          command: "curl -s http://localhost:3000/api/health | jq .ok",
        },
        {
          order: 4,
          instruction: "Portal Health prüfen",
          command: "curl -s http://localhost:3001/api/health | jq .ok",
        },
      ],
    },
    {
      id: "update_uwe",
      title: "UWE aktualisieren",
      summary: "Neue Version vom Git-Remote auf den Linux-Production-Host holen.",
      steps: [
        {
          order: 1,
          instruction: "Optional: Backup erstellen",
          command: "/backup",
        },
        {
          order: 2,
          instruction:
            "Studio: Hardware / Homelab → UWE Host-Update (Owner, UWE_HOST_UPDATE_ENABLED=true)",
          command: "/hardware",
        },
        {
          order: 3,
          instruction: "Alternativ per SSH auf dem Host",
          command:
            "cd /opt/uwe && git pull && sudo bash ./deploy/scripts/setup-uwe-host.sh --quick",
        },
        {
          order: 4,
          instruction: "Nach dem Update Health prüfen",
          command: "curl -s http://127.0.0.1:3000/api/health",
        },
      ],
    },
    {
      id: "check_logs",
      title: "Logs prüfen",
      summary: "Typische Log-Quellen bei Fehlern.",
      steps: [
        {
          order: 1,
          instruction: "UWE Host-Status",
          command: "./scripts/uwe-host-status.sh",
        },
        {
          order: 2,
          instruction: "UWE Host Logs (systemd)",
          command: "journalctl -u uwe.service -f -n 100",
        },
        {
          order: 3,
          instruction: "Studio Admin Status im Browser",
          command: "/admin/status",
        },
        {
          order: 4,
          instruction: "RTX Connector Logs (oder Legacy RTX Agent Konsole, falls noch genutzt)",
        },
      ],
    },
    {
      id: "check_ssh",
      title: "SSH prüfen",
      summary: "Remote-Zugriff auf Host und RTX-Rechner.",
      steps: [
        {
          order: 1,
          instruction: "SSH-Verbindung testen",
          command: "ssh -p <port> <user>@<host-ip> 'echo OK'",
        },
        {
          order: 2,
          instruction: "Nur erlaubte User — kein Root-Login per Passwort",
        },
        {
          order: 3,
          instruction: "Firewall: SSH-Port nur aus LAN/VPN",
        },
      ],
    },
    {
      id: "check_cloudflare",
      title: "Cloudflare prüfen",
      summary: "Tunnel und Access — RTX/Ollama nie im Tunnel.",
      steps: [
        { order: 1, instruction: "Tunnel-Status", command: "cloudflared tunnel list" },
        {
          order: 2,
          instruction: "Ingress zeigt nur auf UWE (Studio/Portal) — nicht auf Ollama/RTX",
        },
        {
          order: 3,
          instruction: "Cloudflare Access Policy für Studio aktiv?",
        },
        {
          order: 4,
          instruction: "ENV: CLOUDFLARE_TUNNEL=true und TRUST_PROXY=true gesetzt",
        },
      ],
    },
    {
      id: "check_db_migration",
      title: "DB Migration prüfen",
      summary: "Schema-Stand vor und nach Updates.",
      steps: [
        {
          order: 1,
          instruction: "Migration-Status",
          command: "pnpm --filter @uwe/database db:migrate:status",
        },
        {
          order: 2,
          instruction: "Health-Endpoint Migrationen",
          command: "curl -s http://localhost:3000/api/health | jq .migrations",
        },
        {
          order: 3,
          instruction: "Vor Production-Deploy: Backup erstellen unter /backup",
        },
      ],
    },
    {
      id: "check_rtx_agent",
      title: "RTX-Agent prüfen (Legacy)",
      summary: "Legacy inbound RTX Agent — deprecated; bevorzugt outbound Connector. Nur Heimnetz, Token erforderlich.",
      steps: [
        {
          order: 1,
          instruction: "Agent Health (nur aus LAN)",
          command: "curl -s -H 'Authorization: Bearer $RTX_AGENT_TOKEN' http://<rtx-ip>:8787/health",
        },
        {
          order: 2,
          instruction: "Ollama erreichbar vom Agent",
          command: "curl -s http://<rtx-ip>:11434/api/tags",
        },
        {
          order: 3,
          instruction: "Studio Inference Health",
          command: "/admin/status → RTX Inference",
        },
        {
          order: 4,
          instruction: "Niemals RTX-Agent-URL in Cloudflare Tunnel oder publicUrl eintragen",
        },
      ],
    },
  ];
}

export function buildHomelabSecurityChecklist(input: {
  system: SystemStatus;
  studioSecurity: StudioSecurityAssessment;
  rtxExposure: RtxExposureAssessment;
  roleCounts: UserRoleCounts;
  hardwareUrlWarnings: HardwareUrlWarning[];
  env?: NodeJS.ProcessEnv;
}): HomelabSecurityCheckItem[] {
  const env = input.env ?? process.env;
  const sshPort = env.SSH_PORT?.trim() || env.UWE_SSH_PORT?.trim();
  const publicExposure = input.studioSecurity.publicExposureConfigured;
  const rtxPublic =
    input.rtxExposure.severity === "critical" ||
    input.hardwareUrlWarnings.some((warning) => warning.field === "publicUrl");

  const ownerCount = input.roleCounts.owner;
  const totalUsers =
    input.roleCounts.owner +
    input.roleCounts.admin +
    input.roleCounts.dm +
    input.roleCounts.player;

  return [
    {
      id: "ssh_port",
      label: "SSH-Port dokumentiert / nicht Standard",
      ok: Boolean(sshPort && sshPort !== "22"),
      severity: sshPort ? (sshPort === "22" ? "warn" : "ok") : "unknown",
      message: sshPort
        ? `SSH_PORT=${sshPort}${sshPort === "22" ? " — Standardport, Firewall prüfen" : ""}`
        : "SSH_PORT nicht in ENV — manuell in Hardware-Notizen dokumentieren",
      manual: !sshPort,
    },
    {
      id: "allowed_users",
      label: "Erlaubte User (Owner/Admin)",
      ok: ownerCount >= 1 && totalUsers <= 20,
      severity: ownerCount === 0 ? "error" : totalUsers > 20 ? "warn" : "ok",
      message: `${totalUsers} User gesamt (${ownerCount} Owner, ${input.roleCounts.admin} Admin, ${input.roleCounts.dm} DM, ${input.roleCounts.player} Player)`,
      manual: false,
    },
    {
      id: "cloudflare_access",
      label: "Cloudflare Access vor öffentlichem Studio",
      ok: !publicExposure || input.studioSecurity.proxyIndicators.networkProtectionLikely,
      severity: publicExposure ? (input.studioSecurity.proxyIndicators.networkProtectionLikely ? "ok" : "warn") : "ok",
      message: publicExposure
        ? input.studioSecurity.proxyIndicators.networkProtectionLikely
          ? "Tunnel/TRUST_PROXY deuten auf Netzwerk-Schutz hin — Access Policy manuell prüfen"
          : "Öffentliche Erreichbarkeit ohne erkennbaren Tunnel-Schutz"
        : "Nur lokal — Cloudflare Access optional",
      manual: true,
    },
    {
      id: "no_public_rtx",
      label: "Keine öffentliche RTX-Agent-URL",
      ok: !rtxPublic && input.rtxExposure.severity !== "critical",
      severity: rtxPublic || input.rtxExposure.severity === "critical" ? "error" : "ok",
      message:
        input.rtxExposure.severity === "critical"
          ? input.rtxExposure.message
          : rtxPublic
            ? `${input.hardwareUrlWarnings.length} Hardware-URL-Warnung(en) — RTX nur LAN`
            : "RTX/Ollama nicht öffentlich exponiert",
      manual: false,
    },
    {
      id: "secrets_not_in_repo",
      label: "Secrets nicht im Repo",
      ok: true,
      severity: "unknown",
      message: "pnpm secret:scan vor Push — echte Werte nur in .env / Deployment-Secrets",
      manual: true,
    },
    {
      id: "firewall_ports",
      label: "Firewall / offene Ports",
      ok: !publicExposure || input.system.proxy.cloudflareTunnel,
      severity: publicExposure && !input.system.proxy.cloudflareTunnel ? "warn" : "unknown",
      message: publicExposure
        ? "Nur 443/80 via Cloudflare — SSH und RTX-Agent nur LAN/VPN"
        : "Lokal: Studio 3000, Portal 3001, RTX Agent nur LAN",
      manual: true,
    },
  ];
}

export function parseHardwareServices(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }
  const services = (metadata as { services?: unknown }).services;
  if (!Array.isArray(services)) {
    return [];
  }
  return services.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export function parseHardwareSpecsLines(specs: unknown): string[] {
  if (specs == null) {
    return [];
  }
  if (typeof specs === "string" && specs.trim()) {
    return specs.split("\n").map((line) => line.trim()).filter(Boolean);
  }
  if (Array.isArray(specs)) {
    return specs.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  }
  if (typeof specs === "object") {
    return Object.entries(specs as Record<string, unknown>)
      .filter(([, value]) => value != null && String(value).trim())
      .map(([key, value]) => `${key}: ${String(value)}`);
  }
  return [];
}

export function parseHardwareErrorHistory(metadata: unknown): HardwareErrorEntry[] {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }
  const history = (metadata as { errorHistory?: unknown }).errorHistory;
  if (!Array.isArray(history)) {
    return [];
  }

  const entries: HardwareErrorEntry[] = [];
  for (const [index, entry] of history.entries()) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const problem = typeof record.problem === "string" ? record.problem.trim() : "";
    if (!problem) {
      continue;
    }
    entries.push({
      id: typeof record.id === "string" ? record.id : `err-${index}`,
      problem,
      occurredAt:
        typeof record.occurredAt === "string" ? record.occurredAt : new Date(0).toISOString(),
      resolution: typeof record.resolution === "string" ? record.resolution : undefined,
      affectedServices: Array.isArray(record.affectedServices)
        ? record.affectedServices.filter((s): s is string => typeof s === "string")
        : undefined,
    });
  }

  return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function parseHardwareLastCheckedAt(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const value = (metadata as { lastCheckedAt?: unknown }).lastCheckedAt;
  return typeof value === "string" && value.trim() ? value : null;
}

export function appendHardwareErrorEntry(
  metadata: Record<string, unknown> | null | undefined,
  input: {
    problem: string;
    resolution?: string;
    affectedServices?: string[];
    occurredAt?: string;
  },
): Record<string, unknown> {
  const base = metadata && typeof metadata === "object" ? { ...metadata } : {};
  const history = parseHardwareErrorHistory(base);
  const entry: HardwareErrorEntry = {
    id: `err-${Date.now()}`,
    problem: input.problem.trim(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    resolution: input.resolution?.trim() || undefined,
    affectedServices: input.affectedServices?.filter(Boolean),
  };
  return {
    ...base,
    errorHistory: [entry, ...history].slice(0, 50),
  };
}

export function buildHardwareDeviceCardView(
  device: {
    id: string;
    name: string;
    role: string;
    status: string;
    hostname?: string | null;
    ipAddress?: string | null;
    localUrl?: string | null;
    publicUrl?: string | null;
    operatingSystem?: string;
    specs?: unknown;
    setupSteps?: unknown;
    errorNotes?: string | null;
    notes?: string;
    metadata?: unknown;
  },
  _urlWarnings: HardwareUrlWarning[],
): HardwareDeviceCardView {
  return {
    id: device.id,
    name: device.name,
    role: device.role,
    status: device.status,
    hostname: device.hostname ?? null,
    ipAddress: device.ipAddress ?? null,
    localUrl: device.localUrl ?? null,
    publicUrl: device.publicUrl ?? null,
    operatingSystem: device.operatingSystem ?? "",
    specsLines: parseHardwareSpecsLines(device.specs),
    services: parseHardwareServices(device.metadata),
    lastCheckedAt: parseHardwareLastCheckedAt(device.metadata),
    openSetupSteps: countOpenSetupSteps(device.setupSteps),
    setupSteps: Array.isArray(device.setupSteps)
      ? device.setupSteps.map((step) => {
          if (typeof step === "string") {
            return { label: step, done: false };
          }
          const record = step as { label?: string; done?: boolean };
          return { label: record.label ?? "", done: Boolean(record.done) };
        })
      : [],
    errorHistory: parseHardwareErrorHistory(device.metadata),
    notes: device.notes ?? "",
    errorNotes: device.errorNotes ?? null,
  };
}

export interface HomelabTodayAlerts {
  criticalCount: number;
  messages: string[];
  serviceIssueCount: number;
  securityIssueCount: number;
}

export function aggregateHomelabTodayAlerts(input: {
  hardwareIssues: number;
  hardwareUrlWarnings: HardwareUrlWarning[];
  openSetupSteps: number;
  serviceStatuses: HomelabServiceStatus[];
  securityChecks: HomelabSecurityCheckItem[];
}): HomelabTodayAlerts {
  const messages: string[] = [];

  if (input.hardwareIssues > 0) {
    messages.push(`${input.hardwareIssues} Gerät(e) offline/defekt`);
  }
  if (input.hardwareUrlWarnings.length > 0) {
    messages.push(`${input.hardwareUrlWarnings.length} Hardware-URL-Warnung(en)`);
  }

  const serviceIssues = input.serviceStatuses.filter(
    (status) => status.severity === "error" || (status.severity === "warn" && !status.ok),
  );
  for (const issue of serviceIssues) {
    messages.push(`${issue.label}: ${issue.message}`);
  }

  const securityIssues = input.securityChecks.filter(
    (check) => check.severity === "error" || (check.severity === "warn" && !check.ok),
  );
  for (const issue of securityIssues) {
    messages.push(`Security: ${issue.label}`);
  }

  if (input.openSetupSteps > 0) {
    messages.push(`${input.openSetupSteps} offene Setup-Schritte`);
  }

  const criticalCount =
    input.hardwareIssues +
    input.hardwareUrlWarnings.length +
    serviceIssues.filter((s) => s.severity === "error").length +
    securityIssues.filter((s) => s.severity === "error").length;

  return {
    criticalCount,
    messages: messages.slice(0, 8),
    serviceIssueCount: serviceIssues.length,
    securityIssueCount: securityIssues.length,
  };
}

export function aggregateAllHardwareErrorHistory(
  devices: Array<{ id: string; name: string; metadata?: unknown }>,
): Array<HardwareErrorEntry & { deviceId: string; deviceName: string }> {
  return devices
    .flatMap((device) =>
      parseHardwareErrorHistory(device.metadata).map((entry) => ({
        ...entry,
        deviceId: device.id,
        deviceName: device.name,
      })),
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
