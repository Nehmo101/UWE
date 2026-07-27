import fs from "node:fs";
import path from "node:path";
import { resolveBackupsDirFromEnv } from "@uwe/assets";
import { getUweRuntimeConfig, isPublicExposureConfigured } from "@uwe/auth";
import type { PrismaClient } from "./client";
import type { ActivityAction } from "./generated/prisma/client";
import { createActivityLogService } from "./activity-log-service";
import { SettingsService } from "./settings-service";
import { getSystemStatus, type SystemStatus } from "./system-status";
import { assessStudioSecurity, type StudioSecurityAssessment } from "./studio-security";
import {
  isRunDbSeedUnsafe,
  isWeakAuthSecret,
} from "./production-safety";

const SECURITY_AUDIT_ACTIONS: ActivityAction[] = [
  "backup_created",
  "backup_restored",
  "seed_applied",
  "import_executed",
  "export_executed",
  "error",
  "warning",
  "ai_proposal_applied",
];

const UPLOAD_ALLOWED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".pdf",
  ".mp3",
  ".wav",
  ".ogg",
  ".mp4",
  ".webm",
];

export type SecurityWarningSeverity = "info" | "warning" | "critical";

export interface SecurityWarning {
  id: string;
  severity: SecurityWarningSeverity;
  title: string;
  description: string;
}

export interface UserRoleCounts {
  owner: number;
  admin: number;
  dm: number;
  player: number;
}

export interface EnvSecretStatus {
  configured: boolean;
  strong: boolean;
  envKey: string;
  message: string;
}

export interface SecurityDashboardStatus {
  timestamp: string;
  auth: {
    active: boolean;
    portalAuthRequired: boolean;
    message: string;
  };
  roleCounts: UserRoleCounts;
  networkProtection: {
    checklist: string[];
    note: string;
  };
  env: {
    sessionSecret: EnvSecretStatus;
    setupToken: {
      active: boolean;
      secure: boolean;
      message: string;
    };
    rtxServiceToken: {
      required: boolean;
      configured: boolean;
      envKey: string;
      message: string;
    };
  };
  publicRoutes: {
    playerRoutesPublic: boolean;
    studioAdminProtected: boolean;
    details: string[];
  };
  backup: {
    lastBackupAt: string | null;
    lastBackupFilename: string | null;
    restoreAvailable: boolean;
    backupCount: number;
    message: string;
  };
  auditLog: Array<{
    id: string;
    action: string;
    summary: string;
    createdAt: string;
    worldSlug: string | null;
  }>;
  uploadPolicy: {
    maxSizeBytes: number | null;
    maxSizeLabel: string;
    allowedTypes: string[];
    note: string;
  };
  aiPolicy: {
    enabled: boolean;
    localOnly: boolean;
    allowedModels: string[];
    rateLimits: string[];
    message: string;
  };
  warnings: SecurityWarning[];
  studioSecurity: StudioSecurityAssessment;
}

function resolveAiEnabled(env: NodeJS.ProcessEnv): boolean {
  const inferenceFlag = env.AI_INFERENCE_ENABLED?.trim().toLowerCase();
  if (inferenceFlag === "true") {
    return true;
  }
  if (inferenceFlag === "false") {
    return false;
  }
  return env.AI_BRAIN_ENABLED !== "false";
}

function resolveDefaultModel(env: NodeJS.ProcessEnv): string {
  return (
    env.AI_INFERENCE_DEFAULT_MODEL?.trim() ||
    env.OLLAMA_DEFAULT_MODEL?.trim() ||
    "llama3.2"
  );
}

interface BackupSummary {
  filename: string;
  createdAt: string;
}

function listBackupSummaries(backupsDir?: string): BackupSummary[] {
  const dir = backupsDir ?? resolveBackupsDirFromEnv();
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(zip|json)$/i.test(entry.name))
    .map((entry) => {
      const filePath = path.join(dir, entry.name);
      const stat = fs.statSync(filePath);
      return {
        filename: entry.name,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value.trim() === "") {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return defaultValue;
}

function resolveSessionSecret(env: NodeJS.ProcessEnv): { value: string | undefined; envKey: string } {
  const sessionSecret = env.SESSION_SECRET?.trim();
  if (sessionSecret) {
    return { value: sessionSecret, envKey: "SESSION_SECRET" };
  }
  return { value: env.AUTH_SECRET?.trim(), envKey: "AUTH_SECRET" };
}

function resolveRtxServiceToken(env: NodeJS.ProcessEnv): { value: string | undefined; envKey: string } {
  const rtxService = env.RTX_SERVICE_TOKEN?.trim();
  return { value: rtxService, envKey: "RTX_SERVICE_TOKEN" };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function assessSessionSecret(env: NodeJS.ProcessEnv): EnvSecretStatus {
  const { value, envKey } = resolveSessionSecret(env);
  const configured = Boolean(value);
  const strong = configured && !isWeakAuthSecret(value);

  return {
    configured,
    strong,
    envKey,
    message: !configured
      ? `${envKey} nicht gesetzt`
      : strong
        ? `${envKey} gesetzt und stark`
        : `${envKey} gesetzt aber unsicher (Platzhalter oder zu kurz)`,
  };
}

function assessSetupToken(env: NodeJS.ProcessEnv): SecurityDashboardStatus["env"]["setupToken"] {
  const token = env.UWE_SETUP_TOKEN?.trim();
  if (!token) {
    return {
      active: false,
      secure: true,
      message: "UWE_SETUP_TOKEN deaktiviert (nicht gesetzt)",
    };
  }

  const secure = !isWeakAuthSecret(token);
  return {
    active: true,
    secure,
    message: secure
      ? "UWE_SETUP_TOKEN aktiv — nach Ersteinrichtung entfernen"
      : "UWE_SETUP_TOKEN aktiv aber unsicher (kurz oder Platzhalter)",
  };
}

function assessRtxServiceToken(
  env: NodeJS.ProcessEnv,
  aiEnabled: boolean,
): SecurityDashboardStatus["env"]["rtxServiceToken"] {
  const { value, envKey } = resolveRtxServiceToken(env);
  const configured = Boolean(value);
  const rtxBaseUrl = env.RTX_BASE_URL?.trim();

  const required = aiEnabled && Boolean(rtxBaseUrl);

  let message: string;
  if (!required) {
    message = configured
      ? `${envKey} gesetzt (optional, lokale KI ohne RTX Worker)`
      : "Nicht erforderlich (kein RTX Worker / KI deaktiviert)";
  } else if (configured) {
    message = `${envKey} gesetzt`;
  } else {
    message = `${envKey} fehlt — RTX_BASE_URL ist konfiguriert`;
  }

  return {
    required,
    configured,
    envKey,
    message,
  };
}

export async function getUserRoleCounts(db: PrismaClient): Promise<UserRoleCounts> {
  const grouped = await db.user.groupBy({
    by: ["role"],
    _count: { role: true },
  });

  const counts: UserRoleCounts = { owner: 0, admin: 0, dm: 0, player: 0 };
  for (const entry of grouped) {
    if (entry.role === "owner") counts.owner = entry._count.role;
    else if (entry.role === "admin") counts.admin = entry._count.role;
    else if (entry.role === "dm") counts.dm = entry._count.role;
    else if (entry.role === "player") counts.player = entry._count.role;
  }

  return counts;
}

export function buildSecurityWarnings(input: {
  env: NodeJS.ProcessEnv;
  system: SystemStatus;
  studioSecurity: StudioSecurityAssessment;
  sessionSecret: EnvSecretStatus;
  setupToken: SecurityDashboardStatus["env"]["setupToken"];
  backupCount: number;
  authActive: boolean;
}): SecurityWarning[] {
  const warnings: SecurityWarning[] = [];
  const runtime = getUweRuntimeConfig(input.env);
  const publicExposure = isPublicExposureConfigured(input.env);

  if (!runtime.isProduction) {
    warnings.push({
      id: "security:node-env",
      severity: "warning",
      title: "NODE_ENV ist nicht production",
      description: `Aktuell: ${input.system.app.nodeEnv}. Für Self-Hosting NODE_ENV=production setzen.`,
    });
  }

  if (
    publicExposure &&
    input.system.proxy.publicAppUrl?.startsWith("https://") &&
    !runtime.sessionCookieSecure
  ) {
    warnings.push({
      id: "security:cookie-insecure",
      severity: "critical",
      title: "Unsichere Cookie-Konfiguration",
      description:
        "Öffentliche HTTPS-URL, aber SESSION_COOKIE_SECURE=false — Session-Cookies können über HTTP abgegriffen werden.",
    });
  }

  if (runtime.sessionCookieSameSite === "none" && !runtime.sessionCookieSecure) {
    warnings.push({
      id: "security:cookie-samesite-none",
      severity: "critical",
      title: "SameSite=none ohne Secure-Cookies",
      description: "SESSION_COOKIE_SAMESITE=none erfordert SESSION_COOKIE_SECURE=true.",
    });
  }

  if (input.setupToken.active) {
    warnings.push({
      id: "security:setup-token-active",
      severity: input.setupToken.secure ? "warning" : "critical",
      title: "Setup-Token noch aktiv",
      description: input.setupToken.message,
    });
  }

  if (isRunDbSeedUnsafe()) {
    warnings.push({
      id: "security:run-db-seed",
      severity: "warning",
      title: "Demo-Setup noch aktiv",
      description: "RUN_DB_SEED ist nicht false — Demo-Welten können automatisch angelegt werden.",
    });
  }

  if (input.backupCount === 0) {
    warnings.push({
      id: "security:no-backups",
      severity: "warning",
      title: "Keine Backups vorhanden",
      description: "Erstelle ein Vollbackup unter /backup, bevor du größere Änderungen vornimmst.",
    });
  }

  if (!input.authActive && publicExposure) {
    warnings.push({
      id: "security:no-admin-auth",
      severity: "critical",
      title: "Portal-Auth nicht aktiv",
      description:
        "AUTH_REQUIRED=false ist für Production nicht mehr vorgesehen — Portal-Routen erzwingen Login über die Route-Policy.",
    });
  }

  if (!input.sessionSecret.strong) {
    warnings.push({
      id: "security:session-secret",
      severity: "critical",
      title: "Session-Secret fehlt oder ist unsicher",
      description: input.sessionSecret.message,
    });
  }

  if (input.studioSecurity.severity === "critical") {
    warnings.push({
      id: "security:studio-exposure",
      severity: "critical",
      title: input.studioSecurity.label,
      description: input.studioSecurity.message,
    });
  }

  return warnings;
}

export async function getSecurityDashboardStatus(
  db: PrismaClient,
  options: { env?: NodeJS.ProcessEnv; backupsDir?: string } = {},
): Promise<SecurityDashboardStatus> {
  const env = options.env ?? process.env;
  const runtime = getUweRuntimeConfig(env);
  const aiEnabled = resolveAiEnabled(env);
  const defaultModel = resolveDefaultModel(env);
  const system = await getSystemStatus(db);
  const studioSecurity = assessStudioSecurity(system, env);
  const settings = await new SettingsService(db).getSettings();

  const sessionSecret = assessSessionSecret(env);
  const setupToken = assessSetupToken(env);
  const rtxServiceToken = assessRtxServiceToken(env, aiEnabled);
  const roleCounts = await getUserRoleCounts(db);

  const authActive = runtime.authRequired && sessionSecret.configured && sessionSecret.strong;

  const backups = listBackupSummaries(options.backupsDir);
  const lastBackup = backups[0] ?? null;

  const activityLog = createActivityLogService(db);
  const auditEntries = await activityLog.list({
    limit: 15,
    actions: SECURITY_AUDIT_ACTIONS,
  });

  const uploadMaxRaw = env.UWE_UPLOAD_MAX_BYTES?.trim();
  const uploadMaxBytes = uploadMaxRaw ? Number.parseInt(uploadMaxRaw, 10) : null;
  const uploadMaxLabel =
    uploadMaxBytes != null && Number.isFinite(uploadMaxBytes)
      ? formatBytes(uploadMaxBytes)
      : "Kein Limit (nicht in Code erzwungen)";

  const aiLocalOnly =
    parseBooleanEnv(env.AI_LOCAL_ONLY, false) || parseBooleanEnv(env.AI_DATENSCHUTZ_MODE, false);

  const allowedModels = [
    defaultModel,
    env.BRAIN_EMBEDDING_MODEL?.trim(),
    env.AI_INFERENCE_DEFAULT_MODEL?.trim(),
  ].filter((model): model is string => Boolean(model));

  const rateLimits = [
    "Login: 8 Versuche / 5 Min (Portal, prozesslokal)",
    "Share-Passwort: 10 Versuche / 1 Min (Portal, prozesslokal)",
    env.AI_RATE_LIMIT_MAX
      ? `KI: ${env.AI_RATE_LIMIT_MAX} Anfragen / ${env.AI_RATE_LIMIT_WINDOW_MS ?? "60000"} ms`
      : "KI: kein explizites ENV-Limit (Studio-Netz-Schutz)",
  ];

  const playerRoutesPublic =
    runtime.playerPreviewPublic || (!runtime.authRequired && !runtime.isProduction);

  const studioAdminProtected = studioSecurity.severity !== "critical";

  const publicRouteDetails = [
    `Portal Player Preview öffentlich: ${runtime.playerPreviewPublic ? "ja" : "nein"}`,
    `Portal AUTH_REQUIRED: ${runtime.authRequired ? "ja" : "nein"}`,
    `Studio öffentlich erreichbar: ${studioSecurity.publicExposureConfigured ? "ja" : "nein"}`,
    `Studio API Token: ${studioSecurity.checks.studioApiTokenConfigured ? "gesetzt" : "fehlt"}`,
    `Gastzugang Portal: ${settings.portal.guestAccessEnabled ? "aktiv" : "deaktiviert"}`,
    `Öffentliche Share-Links: ${settings.portal.publicSharingEnabled ? "aktiv" : "deaktiviert"}`,
  ];

  const warnings = buildSecurityWarnings({
    env,
    system,
    studioSecurity,
    sessionSecret,
    setupToken,
    backupCount: backups.length,
    authActive,
  });

  return {
    timestamp: new Date().toISOString(),
    auth: {
      active: authActive,
      portalAuthRequired: runtime.authRequired,
      message: authActive
        ? "Portal-Login ist aktiv und Session-Secret ist gesetzt."
        : runtime.authRequired
          ? "AUTH_REQUIRED=true, aber Session-Secret fehlt oder ist unsicher."
          : "Portal-Login ist optional — für öffentliches Portal AUTH_REQUIRED=true setzen.",
    },
    roleCounts,
    networkProtection: {
      checklist: [
        "AUTH_REQUIRED=true — Zugang zu Studio & Portal über den UWE-Login (E-Mail)?",
        "Tunnel/Ingress zeigt nur auf UWE — nicht auf Ollama/RTX?",
        "TRUST_PROXY=true und CLOUDFLARE_TUNNEL=true gesetzt?",
        "STUDIO_API_TOKEN für sensible APIs gesetzt?",
        "Optional: „Ich bin ein Mensch“-Prüfung (Cloudflare Managed Challenge/Turnstile) vor den Websites aktiv?",
      ],
      note:
        "Netzwerk-Schutz und die „Ich bin ein Mensch“-Prüfung liegen bei Cloudflare und sind serverseitig nicht automatisch verifizierbar — Checkliste manuell prüfen.",
    },
    env: {
      sessionSecret,
      setupToken,
      rtxServiceToken,
    },
    publicRoutes: {
      playerRoutesPublic,
      studioAdminProtected,
      details: publicRouteDetails,
    },
    backup: {
      lastBackupAt: lastBackup?.createdAt ?? null,
      lastBackupFilename: lastBackup?.filename ?? null,
      restoreAvailable: backups.length > 0,
      backupCount: backups.length,
      message:
        backups.length === 0
          ? "Keine Backups im Backup-Verzeichnis gefunden."
          : `Letztes Backup: ${lastBackup?.filename ?? "—"}`,
    },
    auditLog: auditEntries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      summary: entry.summary,
      createdAt: entry.createdAt.toISOString(),
      worldSlug: entry.worldSlug,
    })),
    uploadPolicy: {
      maxSizeBytes: uploadMaxBytes,
      maxSizeLabel: uploadMaxLabel,
      allowedTypes: UPLOAD_ALLOWED_EXTENSIONS,
      note: "Kein strikter MIME-Whitelist — Dateityp wird aus Extension inferiert; Path-Traversal blockiert.",
    },
    aiPolicy: {
      enabled: aiEnabled,
      localOnly: aiLocalOnly,
      allowedModels: [...new Set(allowedModels)],
      rateLimits,
      message: aiEnabled
        ? aiLocalOnly
          ? "KI aktiv — nur lokale Provider erlaubt."
          : "KI aktiv — Cloud- und lokale Provider möglich."
        : "KI deaktiviert (AI_INFERENCE_ENABLED=false oder AI_BRAIN_ENABLED=false).",
    },
    warnings,
    studioSecurity,
  };
}

/** Ensures serialized security dashboard never contains secret env values. */
export function assertSecurityDashboardHasNoSecrets(
  status: SecurityDashboardStatus,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const serialized = JSON.stringify(status);
  const secretKeys = [
    "SESSION_SECRET",
    "AUTH_SECRET",
    "UWE_SETUP_TOKEN",
    "RTX_SERVICE_TOKEN",
    "RTX_AGENT_TOKEN",
    "STUDIO_API_TOKEN",
    "AI_INFERENCE_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
    "CLOUD_AI_API_KEY",
    "SMTP_PASSWORD",
    "SPOTIFY_CLIENT_SECRET",
  ] as const;

  for (const key of secretKeys) {
    const value = env[key]?.trim();
    if (value && serialized.includes(value)) {
      throw new Error(`Security dashboard leaked secret from ${key}`);
    }
  }
}
