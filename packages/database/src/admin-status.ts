import type { PrismaClient } from "./client";
import { Prisma } from "./generated/prisma/client";
import { getSystemStatus, type SystemStatus } from "./system-status";
import {
  assessRtxExposure,
  assessStudioSecurity,
  type RtxExposureAssessment,
  type StudioSecurityAssessment,
} from "./studio-security";
import type { MailConfigStatus } from "@uwe/mail-core";
import { createMailLogService } from "./mail-log-service";
import { createMailService } from "./mail-service";
import { createJobService, type JobSummary } from "./job-service";

type EndpointUrlKind = "loopback" | "private" | "link_local" | "public";

function sanitizeEndpointLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${parsed.hostname}${port}`;
  } catch {
    return "(ungültige URL)";
  }
}

function classifyEndpointUrl(url: string): EndpointUrlKind {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return "loopback";
    }
    if (
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return "private";
    }
    if (hostname.startsWith("169.254.") || hostname.startsWith("fe80:")) {
      return "link_local";
    }
    return "public";
  } catch {
    return "public";
  }
}

function isPrivateEndpointUrl(url: string, allowPublicUrl: boolean): boolean {
  if (allowPublicUrl) {
    return true;
  }
  const kind = classifyEndpointUrl(url);
  return kind === "loopback" || kind === "private" || kind === "link_local";
}

/**
 * Admin dashboard status — aggregates operational health without secrets.
 * Used by the protected Studio admin status page (P11).
 */

export interface MailHealthStatus extends MailConfigStatus {
  ok: boolean;
  nextSteps: string[];
  failedLogCount: number;
  lastFailure: {
    subject: string;
    errorMessage: string | null;
    createdAt: string;
  } | null;
}

export interface BrainStoreHealthStatus {
  enabled: boolean;
  storage: string;
  ok: boolean;
  documentCount: number;
  chunkCount: number;
  factCount: number;
  embeddedChunkCount: number;
  message: string;
  nextSteps: string[];
}

export interface EmbeddingHealthStatus {
  enabled: boolean;
  provider: string | null;
  model: string | null;
  endpoint: string | null;
  storeLocation: string;
  ok: boolean;
  indexedChunks: number;
  totalChunks: number;
  coveragePercent: number | null;
  message: string;
  nextSteps: string[];
  offlineReason?: string;
}

export interface AiRunSummaryItem {
  id: string;
  taskType: string;
  provider: string;
  model: string;
  status: string;
  createdAt: string;
  errorMessage: string | null;
}

export interface AiRunSummaryStatus {
  ok: boolean;
  totalRuns: number;
  pendingCount: number;
  runningCount: number;
  failedCount: number;
  openProposalsCount: number;
  lastRun: AiRunSummaryItem | null;
  recentFailures: AiRunSummaryItem[];
  message: string;
  nextSteps: string[];
}

export interface JobsHealthStatus {
  queueImplemented: boolean;
  ok: boolean;
  pendingCount: number;
  runningCount: number;
  failedCount: number;
  completedCount: number;
  message: string;
  nextSteps: string[];
  recentFailures: Array<{
    id: string;
    type: string;
    title: string;
    errorMessage: string | null;
    createdAt: string;
  }>;
}

export interface AuthHealthStatus {
  portalAuthRequired: boolean;
  studioApiTokenConfigured: boolean;
  authSecretConfigured: boolean;
  authSecretLooksWeak: boolean;
  ok: boolean;
  message: string;
  nextSteps: string[];
}

export interface AdminStatus {
  ok: boolean;
  timestamp: string;
  system: SystemStatus;
  studioSecurity: StudioSecurityAssessment;
  rtxExposure: RtxExposureAssessment;
  mail: MailHealthStatus;
  brain: BrainStoreHealthStatus;
  embeddings: EmbeddingHealthStatus;
  aiRuns: AiRunSummaryStatus;
  jobs: JobsHealthStatus;
  auth: AuthHealthStatus;
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

function buildMailNextSteps(config: MailConfigStatus): string[] {
  const nextSteps: string[] = [];

  if (!config.enabled) {
    nextSteps.push("Setze MAIL_ENABLED=true, wenn ausgehende Mails genutzt werden sollen.");
  } else if (config.useMock) {
    nextSteps.push("Mock-Modus ist aktiv — für Production echtes SMTP konfigurieren.");
  } else if (!config.host) {
    nextSteps.push("Trage SMTP_HOST in .env ein (z. B. smtp.example.com).");
  } else if (!config.fromAddress) {
    nextSteps.push("Setze MAIL_FROM (z. B. UWE <uwe@example.org>).");
  } else if (!config.userConfigured || !config.passwordConfigured) {
    nextSteps.push(
      "Prüfe SMTP_USER und SMTP_PASSWORD — viele Provider verlangen beides für den Versand.",
    );
  } else {
    nextSteps.push("Sende eine Testmail im Mail Center, um die SMTP-Verbindung zu prüfen.");
  }

  return nextSteps;
}

function isMailConfigOk(config: MailConfigStatus): boolean {
  if (!config.enabled) {
    return true;
  }
  if (config.useMock) {
    return true;
  }
  return config.configured && config.userConfigured && config.passwordConfigured;
}

export async function getMailHealthStatus(
  db: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<MailHealthStatus> {
  const mailService = createMailService(db);
  const config = await mailService.getConfigStatus(env);
  const nextSteps = buildMailNextSteps(config);

  let failedLogCount = 0;
  let lastFailure: MailHealthStatus["lastFailure"] = null;

  try {
    const logService = createMailLogService(db);
    const [failures, totalFailed] = await Promise.all([
      logService.list({ status: "failed", limit: 1 }),
      db.mailMessageLog.count({ where: { status: "failed" } }),
    ]);
    failedLogCount = totalFailed;
    if (failures[0]) {
      lastFailure = {
        subject: failures[0].subject,
        errorMessage: failures[0].errorMessage,
        createdAt: failures[0].createdAt.toISOString(),
      };
      nextSteps.unshift(
        `Letzter Mail-Fehler: ${failures[0].errorMessage ?? "Unbekannt"} — Logs im Mail Center prüfen.`,
      );
    }
  } catch {
    nextSteps.push("Mail-Logs konnten nicht gelesen werden — Migrationen prüfen.");
  }

  const ok = isMailConfigOk(config) && failedLogCount === 0;

  return {
    ...config,
    ok,
    nextSteps,
    failedLogCount,
    lastFailure,
  };
}

function resolveBrainEnabled(env: NodeJS.ProcessEnv): boolean {
  return parseBooleanEnv(env.BRAIN_ENABLED, true);
}

function resolveBrainStorage(env: NodeJS.ProcessEnv): string {
  return env.BRAIN_STORAGE?.trim() || "database";
}

export async function getBrainStoreHealthStatus(
  db: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<BrainStoreHealthStatus> {
  const enabled = resolveBrainEnabled(env);
  const storage = resolveBrainStorage(env);
  const nextSteps: string[] = [];

  if (!enabled) {
    return {
      enabled: false,
      storage,
      ok: true,
      documentCount: 0,
      chunkCount: 0,
      factCount: 0,
      embeddedChunkCount: 0,
      message: "Brain Store ist deaktiviert (BRAIN_ENABLED=false).",
      nextSteps: ["Setze BRAIN_ENABLED=true, um Brain-Wissen zu speichern."],
    };
  }

  try {
    const [documentCount, chunkCount, factCount, embeddedChunkCount] = await Promise.all([
      db.brainDocument.count(),
      db.brainChunk.count(),
      db.brainFact.count(),
      db.brainChunk.count({ where: { NOT: { embedding: { equals: Prisma.DbNull } } } }),
    ]);

    const ok = true;
    const message =
      documentCount === 0
        ? "Brain Store bereit — noch keine Einträge."
        : `${documentCount} Dokumente, ${factCount} Fakten, ${chunkCount} Chunks gespeichert.`;

    if (documentCount === 0) {
      nextSteps.push("Lege Brain-Dokumente oder Fakten an, um Wissen dauerhaft in UWE zu halten.");
    }

    return {
      enabled,
      storage,
      ok,
      documentCount,
      chunkCount,
      factCount,
      embeddedChunkCount,
      message,
      nextSteps,
    };
  } catch (error) {
    return {
      enabled,
      storage,
      ok: false,
      documentCount: 0,
      chunkCount: 0,
      factCount: 0,
      embeddedChunkCount: 0,
      message: error instanceof Error ? error.message : "Brain Store nicht erreichbar.",
      nextSteps: [
        "Prüfe Datenbank-Migrationen (Brain-Tabellen).",
        "Starte UWE neu und rufe /api/health auf.",
      ],
    };
  }
}

function resolveEmbeddingConfig(env: NodeJS.ProcessEnv) {
  const enabled = parseBooleanEnv(env.BRAIN_EMBEDDINGS_ENABLED, false);
  const provider = env.BRAIN_EMBEDDING_PROVIDER?.trim() || "ollama";
  const model = env.BRAIN_EMBEDDING_MODEL?.trim() || "nomic-embed-text";
  const baseUrl =
    env.BRAIN_EMBEDDING_BASE_URL?.trim() ||
    env.AI_INFERENCE_BASE_URL?.trim() ||
    env.OLLAMA_BASE_URL?.trim() ||
    "http://localhost:11434";
  const storeLocation = env.BRAIN_EMBEDDINGS_STORE?.trim() || "uwe-database";
  const allowPublicUrl = parseBooleanEnv(env.AI_INFERENCE_ALLOW_PUBLIC_URL, false);

  return { enabled, provider, model, baseUrl, storeLocation, allowPublicUrl };
}

export async function getEmbeddingHealthStatus(
  db: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<EmbeddingHealthStatus> {
  const config = resolveEmbeddingConfig(env);
  const nextSteps: string[] = [];

  if (!config.enabled) {
    return {
      enabled: false,
      provider: config.provider,
      model: config.model,
      endpoint: null,
      storeLocation: config.storeLocation,
      ok: true,
      indexedChunks: 0,
      totalChunks: 0,
      coveragePercent: null,
      message: "Embeddings sind deaktiviert (BRAIN_EMBEDDINGS_ENABLED=false).",
      nextSteps: [
        "Semantische Suche benötigt Embeddings — aktiviere BRAIN_EMBEDDINGS_ENABLED=true.",
        "RTX-Rechner muss für Embedding-Berechnung erreichbar sein.",
      ],
    };
  }

  const endpoint = sanitizeEndpointLabel(config.baseUrl);
  const urlAllowed = isPrivateEndpointUrl(config.baseUrl, config.allowPublicUrl);

  let totalChunks = 0;
  let indexedChunks = 0;

  try {
    [totalChunks, indexedChunks] = await Promise.all([
      db.brainChunk.count(),
      db.brainChunk.count({ where: { NOT: { embedding: { equals: Prisma.DbNull } } } }),
    ]);
  } catch {
    return {
      enabled: true,
      provider: config.provider,
      model: config.model,
      endpoint,
      storeLocation: config.storeLocation,
      ok: false,
      indexedChunks: 0,
      totalChunks: 0,
      coveragePercent: null,
      message: "Embedding-Index konnte nicht gelesen werden.",
      nextSteps: ["Prüfe Brain-Chunk-Tabellen in der Datenbank."],
    };
  }

  const coveragePercent =
    totalChunks > 0 ? Math.round((indexedChunks / totalChunks) * 100) : null;

  if (!urlAllowed) {
    const kind = classifyEndpointUrl(config.baseUrl);
    const offlineReason =
      `Embedding-Endpoint ist öffentlich (${kind}) und blockiert. Nutze eine private Heimnetz-IP.`;
    nextSteps.push("Setze BRAIN_EMBEDDING_BASE_URL auf den RTX-Rechner (z. B. http://192.168.x.x:11434).");
    nextSteps.push("Alternativ: AI_INFERENCE_ALLOW_PUBLIC_URL=true nur für Tests.");

    return {
      enabled: true,
      provider: config.provider,
      model: config.model,
      endpoint,
      storeLocation: config.storeLocation,
      ok: false,
      indexedChunks,
      totalChunks,
      coveragePercent,
      message: offlineReason,
      nextSteps,
      offlineReason,
    };
  }

  let endpointReachable = false;
  let reachMessage = "RTX-Embedding-Endpoint nicht geprüft.";

  try {
    if (!urlAllowed) {
      throw new Error("Embedding-Endpoint blockiert.");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const healthUrl =
      config.provider === "ollama"
        ? `${config.baseUrl.replace(/\/$/, "")}/api/tags`
        : `${config.baseUrl.replace(/\/$/, "")}/models`;

    const response = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    endpointReachable = response.ok;
    reachMessage = endpointReachable
      ? "RTX-Embedding-Endpoint erreichbar."
      : `RTX antwortet mit HTTP ${response.status}.`;
  } catch (error) {
    reachMessage =
      error instanceof Error && error.name === "AbortError"
        ? "RTX-Embedding-Endpoint antwortet nicht (Timeout)."
        : error instanceof Error
          ? error.message
          : "RTX-Embedding-Endpoint nicht erreichbar.";
  }

  if (!endpointReachable) {
    nextSteps.push("Prüfe, ob Ollama/LM Studio auf dem RTX-Rechner läuft.");
    nextSteps.push("Prüfe Firewall — Zugriff nur aus dem Heimnetz erlauben.");
    nextSteps.push("Bereits indexierte Vektoren in UWE bleiben lesbar; neue Embeddings warten auf RTX.");
  } else if (totalChunks > 0 && indexedChunks < totalChunks) {
    nextSteps.push(`${totalChunks - indexedChunks} Chunks ohne Embedding — Reindex-Job starten (P10).`);
  } else if (totalChunks === 0) {
    nextSteps.push("Brain-Chunks anlegen, bevor Embeddings berechnet werden können.");
  }

  const ok = endpointReachable;
  const message = endpointReachable
    ? coveragePercent != null
      ? `${indexedChunks}/${totalChunks} Chunks indexiert (${coveragePercent}%). ${reachMessage}`
      : reachMessage
    : reachMessage;

  return {
    enabled: true,
    provider: config.provider,
    model: config.model,
    endpoint,
    storeLocation: config.storeLocation,
    ok,
    indexedChunks,
    totalChunks,
    coveragePercent,
    message,
    nextSteps,
    offlineReason: ok ? undefined : reachMessage,
  };
}

function toAiRunSummaryItem(run: {
  id: string;
  taskType: string;
  provider: string;
  model: string;
  status: string;
  createdAt: Date;
  errorMessage: string | null;
}): AiRunSummaryItem {
  return {
    id: run.id,
    taskType: run.taskType,
    provider: run.provider,
    model: run.model,
    status: run.status,
    createdAt: run.createdAt.toISOString(),
    errorMessage: run.errorMessage,
  };
}

export async function getAiRunSummaryStatus(db: PrismaClient): Promise<AiRunSummaryStatus> {
  const nextSteps: string[] = [];

  try {
    const [
      totalRuns,
      pendingCount,
      runningCount,
      failedCount,
      openProposalsCount,
      lastRun,
      recentFailures,
    ] = await Promise.all([
      db.aiRun.count(),
      db.aiRun.count({ where: { status: "pending" } }),
      db.aiRun.count({ where: { status: "running" } }),
      db.aiRun.count({ where: { status: "failed" } }),
      db.aiRun.count({ where: { status: "completed" } }),
      db.aiRun.findFirst({ orderBy: { createdAt: "desc" } }),
      db.aiRun.findMany({
        where: { status: "failed" },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    ]);

    if (failedCount > 0) {
      nextSteps.push(`${failedCount} fehlgeschlagene AI Runs — Details in der Run-Historie prüfen.`);
    }
    if (openProposalsCount > 0) {
      nextSteps.push(`${openProposalsCount} abgeschlossene Runs warten auf Review/Apply.`);
    }
    if (runningCount > 0) {
      nextSteps.push(`${runningCount} AI Run(s) laufen gerade — RTX muss erreichbar sein.`);
    }

    const ok = failedCount === 0 && runningCount === 0;
    const message =
      totalRuns === 0
        ? "Noch keine AI Runs — erste KI-Aktion startet die Historie."
        : failedCount > 0
          ? `${failedCount} fehlgeschlagene Run(s), zuletzt: ${lastRun?.taskType ?? "—"}.`
          : runningCount > 0
            ? `${runningCount} Run(s) in Bearbeitung.`
            : `${totalRuns} Run(s) gespeichert.`;

    return {
      ok,
      totalRuns,
      pendingCount,
      runningCount,
      failedCount,
      openProposalsCount,
      lastRun: lastRun ? toAiRunSummaryItem(lastRun) : null,
      recentFailures: recentFailures.map(toAiRunSummaryItem),
      message,
      nextSteps,
    };
  } catch {
    return {
      ok: false,
      totalRuns: 0,
      pendingCount: 0,
      runningCount: 0,
      failedCount: 0,
      openProposalsCount: 0,
      lastRun: null,
      recentFailures: [],
      message: "AI-Run-Historie konnte nicht gelesen werden.",
      nextSteps: ["Prüfe ai_runs-Tabelle und Migrationen."],
    };
  }
}

export async function getJobsHealthStatus(db: PrismaClient): Promise<JobsHealthStatus> {
  const nextSteps: string[] = [];

  try {
    const summary: JobSummary = await createJobService(db).getSummary();
    const recentFailures = summary.recentFailed.map((job) => ({
      id: job.id,
      type: job.type,
      title: job.title,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
    }));

    if (summary.failed > 0) {
      nextSteps.push(`${summary.failed} fehlgeschlagene Jobs — Details in der Job-Liste prüfen.`);
    }
    if (summary.running > 0) {
      nextSteps.push(`${summary.running} Job(s) laufen gerade.`);
    }

    const ok = summary.failed === 0;

    return {
      queueImplemented: true,
      ok,
      pendingCount: summary.pending,
      runningCount: summary.running,
      failedCount: summary.failed,
      completedCount: summary.completed,
      message:
        summary.pending === 0 && summary.failed === 0 && summary.running === 0
          ? "Keine offenen Jobs."
          : `${summary.pending} wartend, ${summary.running} laufend, ${summary.failed} fehlgeschlagen.`,
      nextSteps,
      recentFailures,
    };
  } catch {
    return {
      queueImplemented: false,
      ok: false,
      pendingCount: 0,
      runningCount: 0,
      failedCount: 0,
      completedCount: 0,
      message: "Job-Queue konnte nicht gelesen werden.",
      nextSteps: ["Prüfe jobs-Tabelle und Migrationen."],
      recentFailures: [],
    };
  }
}

export function getAuthHealthStatus(system: SystemStatus): AuthHealthStatus {
  const nextSteps: string[] = [];
  const { trust, proxy } = system;

  if (!trust.authSecretConfigured) {
    nextSteps.push("Setze AUTH_SECRET für sichere Sessions (Portal).");
  } else if (trust.authSecretLooksWeak) {
    nextSteps.push("AUTH_SECRET ist schwach — generiere ein langes Zufallssecret.");
  }

  if (!trust.studioApiTokenConfigured && system.app.production) {
    nextSteps.push(
      "Setze STUDIO_API_TOKEN in Production, um Studio-API-Routen zusätzlich abzusichern.",
    );
  }

  if (proxy.publicExposureConfigured && !proxy.authRequired) {
    nextSteps.push("Portal-Auth aktivieren (AUTH_REQUIRED=true) bei öffentlicher Erreichbarkeit.");
  }

  const ok =
    trust.authSecretConfigured &&
    !trust.authSecretLooksWeak &&
    (!system.app.production || trust.studioApiTokenConfigured || !proxy.publicExposureConfigured);

  return {
    portalAuthRequired: proxy.authRequired,
    studioApiTokenConfigured: trust.studioApiTokenConfigured,
    authSecretConfigured: trust.authSecretConfigured,
    authSecretLooksWeak: trust.authSecretLooksWeak,
    ok,
    message: proxy.authRequired
      ? "Portal-Login ist aktiv (AUTH_REQUIRED=true)."
      : "Portal-Login ist optional — für Production hinter Cloudflare empfohlen.",
    nextSteps,
  };
}

export async function getAdminStatus(
  db: PrismaClient,
  options: { rateLimiterMode?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<AdminStatus> {
  const env = options.env ?? process.env;
  const system = await getSystemStatus(db, {
    rateLimiterMode: options.rateLimiterMode,
    env,
  });

  const [mail, brain, embeddings, aiRuns, jobs] = await Promise.all([
    getMailHealthStatus(db, env),
    getBrainStoreHealthStatus(db, env),
    getEmbeddingHealthStatus(db, env),
    getAiRunSummaryStatus(db),
    getJobsHealthStatus(db),
  ]);

  const auth = getAuthHealthStatus(system);
  const studioSecurity = assessStudioSecurity(system, env);
  const rtxExposure = assessRtxExposure(env);

  const ok =
    system.ok &&
    studioSecurity.severity !== "critical" &&
    rtxExposure.severity !== "critical" &&
    (!mail.enabled || mail.ok) &&
    brain.ok &&
    (!embeddings.enabled || embeddings.ok);

  return {
    ok,
    timestamp: new Date().toISOString(),
    system,
    studioSecurity,
    rtxExposure,
    mail,
    brain,
    embeddings,
    aiRuns,
    jobs,
    auth,
  };
}

/** Ensures serialized admin status never contains secret env values. */
export function assertAdminStatusHasNoSecrets(
  status: AdminStatus,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const serialized = JSON.stringify(status);
  const secretKeys = [
    "SESSION_SECRET",
    "SMTP_PASSWORD",
    "AUTH_SECRET",
    "UWE_SETUP_TOKEN",
    "STUDIO_API_TOKEN",
    "AI_INFERENCE_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
    "RTX_SERVICE_TOKEN",
    "RTX_AGENT_TOKEN",
    "CLOUD_AI_API_KEY",
    "SPOTIFY_CLIENT_SECRET",
  ] as const;

  for (const key of secretKeys) {
    const value = env[key]?.trim();
    if (value && serialized.includes(value)) {
      throw new Error(`Admin status leaked secret from ${key}`);
    }
  }
}
