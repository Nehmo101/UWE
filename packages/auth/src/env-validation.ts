import { getUweRuntimeConfig, isPublicExposureConfigured } from "./runtime-config";
import { getTurnstileConfig } from "./turnstile";

export type EnvValidationSeverity = "error" | "warning" | "info";

export interface EnvValidationIssue {
  id: string;
  severity: EnvValidationSeverity;
  message: string;
  envKey?: string;
}


const WEAK_AUTH_SECRET_PATTERNS = [
  /^change[-_]?me/i,
  /^changeme$/i,
  /^generate-a-random-secret-for-production$/i,
  /^super-secret$/i,
  /^your-secret-here$/i,
  /^dev(elopment)?$/i,
  /^test$/i,
  /^password$/i,
  /^secret$/i,
  /^uwe-dev$/i,
];

export function isWeakAuthSecretValue(secret: string | undefined): boolean {
  const trimmed = secret?.trim();
  if (!trimmed) {
    return true;
  }
  if (trimmed.length < 16) {
    return true;
  }
  return WEAK_AUTH_SECRET_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Validates environment configuration for self-hosted / production deployments.
 * Never includes secret values in output.
 */
export function validateUweEnvironment(env: NodeJS.ProcessEnv = process.env): EnvValidationIssue[] {
  const issues: EnvValidationIssue[] = [];
  const runtime = getUweRuntimeConfig(env);
  const publicExposure = isPublicExposureConfigured(env);

  if (isWeakAuthSecretValue(env.AUTH_SECRET)) {
    issues.push({
      id: "env:auth-secret",
      severity: "error",
      envKey: "AUTH_SECRET",
      message:
        "AUTH_SECRET fehlt oder ist unsicher — setze ein starkes Zufallssecret (z. B. openssl rand -base64 32).",
    });
  }

  if (runtime.isProduction && (env.RUN_DB_SEED ?? "auto") !== "false") {
    issues.push({
      id: "env:run-db-seed",
      severity: "error",
      envKey: "RUN_DB_SEED",
      message: "RUN_DB_SEED muss in Production false sein — sonst werden Demo-Welten angelegt.",
    });
  }

  if (publicExposure && !env.STUDIO_API_TOKEN?.trim()) {
    issues.push({
      id: "env:studio-api-token",
      severity: "error",
      envKey: "STUDIO_API_TOKEN",
      message:
        "Öffentliche Erreichbarkeit erkannt — STUDIO_API_TOKEN setzen und Studio hinter Cloudflare Access schützen.",
    });
  } else if (!env.STUDIO_API_TOKEN?.trim()) {
    issues.push({
      id: "env:studio-api-token-recommended",
      severity: "warning",
      envKey: "STUDIO_API_TOKEN",
      message: runtime.isProduction
        ? "STUDIO_API_TOKEN nicht gesetzt — in Production dringend empfohlen für Backup, Restore, Settings und AI-APIs."
        : "STUDIO_API_TOKEN nicht gesetzt — empfohlen für Backup, Restore, Settings und AI-APIs.",
    });
  }

  if (publicExposure && runtime.isProduction && !runtime.trustProxy) {
    issues.push({
      id: "env:trust-proxy",
      severity: "error",
      envKey: "TRUST_PROXY",
      message: "TRUST_PROXY=true setzen, wenn UWE hinter Cloudflare oder Reverse-Proxy läuft.",
    });
  }

  if (runtime.isProduction && runtime.playerPreviewAllowDmOnly) {
    issues.push({
      id: "env:player-preview-dm-only",
      severity: "error",
      envKey: "PLAYER_PREVIEW_ALLOW_DM_ONLY",
      message: "PLAYER_PREVIEW_ALLOW_DM_ONLY darf in Production nicht aktiv sein.",
    });
  }

  if (runtime.isProduction && !runtime.authRequired && publicExposure) {
    issues.push({
      id: "env:auth-required",
      severity: "error",
      envKey: "AUTH_REQUIRED",
      message:
        "AUTH_REQUIRED=false bei öffentlicher Erreichbarkeit macht jeden Anonymen zum Owner (Studio-Dev-Bypass) — auf true setzen.",
    });
  }

  if (runtime.isProduction && publicExposure && !runtime.sessionCookieSecure) {
    issues.push({
      id: "env:session-cookie-secure",
      severity: "error",
      envKey: "SESSION_COOKIE_SECURE",
      message: "SESSION_COOKIE_SECURE=true bei HTTPS/öffentlicher URL erforderlich.",
    });
  }

  const turnstile = getTurnstileConfig(env);
  const turnstileSiteKeySet = Boolean(env.TURNSTILE_SITE_KEY?.trim());
  if (turnstileSiteKeySet !== turnstile.secretConfigured) {
    issues.push({
      id: "env:turnstile-partial",
      severity: "warning",
      envKey: turnstileSiteKeySet ? "TURNSTILE_SECRET_KEY" : "TURNSTILE_SITE_KEY",
      message:
        "Turnstile-„Mensch-Prüfung“ unvollständig — TURNSTILE_SITE_KEY und TURNSTILE_SECRET_KEY müssen beide gesetzt sein, sonst bleibt die Prüfung inaktiv.",
    });
  }

  if (env.AI_INFERENCE_ALLOW_PUBLIC_URL?.trim().toLowerCase() === "true" && runtime.isProduction) {
    issues.push({
      id: "env:inference-public-url",
      severity: "warning",
      envKey: "AI_INFERENCE_ALLOW_PUBLIC_URL",
      message: "AI_INFERENCE_ALLOW_PUBLIC_URL=true in Production — Maschinenraum nur im Heimnetz betreiben.",
    });
  }

  return issues;
}

export function hasBlockingEnvIssues(issues: EnvValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

/** Thrown at boot when production env has blocking (error-severity) issues. */
export class BlockingEnvError extends Error {
  readonly issues: EnvValidationIssue[];

  constructor(issues: EnvValidationIssue[]) {
    super(formatBlockingEnvMessage(issues));
    this.name = "BlockingEnvError";
    this.issues = issues;
  }
}

function formatBlockingEnvMessage(issues: EnvValidationIssue[]): string {
  const lines = issues.map(
    (issue) => `- ${issue.envKey ?? issue.id}: ${issue.message}`,
  );
  return `Blockierende Env-Konfigurationsfehler (${issues.length}):\n${lines.join("\n")}`;
}

/**
 * Escape hatch for controlled test setups (e.g. Playwright E2E runs a
 * production build over plain HTTP with SESSION_COOKIE_SECURE=false).
 * Never set this on a real deployment.
 */
export const ALLOW_INSECURE_ENV_VAR = "UWE_ALLOW_INSECURE_ENV";

function isInsecureEnvAllowed(env: NodeJS.ProcessEnv): boolean {
  return env[ALLOW_INSECURE_ENV_VAR]?.trim() === "1";
}

/**
 * Boot-time enforcement of {@link validateUweEnvironment}:
 *
 * - NODE_ENV=production + error-severity issues → throws {@link BlockingEnvError}
 *   (hard startup abort) naming the offending env variables.
 * - dev/test, or production with UWE_ALLOW_INSECURE_ENV=1 → logs a warning only.
 *
 * Call from apps' instrumentation.ts (Node runtime) so `next start` refuses to
 * boot with an unsafe production configuration.
 */
export function enforceEnvSafetyAtBoot(
  env: NodeJS.ProcessEnv = process.env,
  logger: Pick<Console, "warn" | "error"> = console,
): EnvValidationIssue[] {
  const issues = validateUweEnvironment(env);
  const blocking = issues.filter((issue) => issue.severity === "error");

  if (blocking.length === 0) {
    return issues;
  }

  const message = formatBlockingEnvMessage(blocking);
  const isProduction = env.NODE_ENV?.trim() === "production";

  if (isProduction && !isInsecureEnvAllowed(env)) {
    logger.error(
      `[uwe][env] Start abgebrochen — ${message}\nBehebe die genannten Variablen oder setze (nur für Tests!) ${ALLOW_INSECURE_ENV_VAR}=1.`,
    );
    throw new BlockingEnvError(blocking);
  }

  if (isProduction) {
    logger.warn(
      `[uwe][env] WARNUNG: ${ALLOW_INSECURE_ENV_VAR}=1 gesetzt — blockierende Env-Fehler werden ignoriert. Nur für Test-Setups zulässig!\n${message}`,
    );
  } else {
    logger.warn(`[uwe][env] ${message}\n(Nur Warnung — harter Abbruch erfolgt erst mit NODE_ENV=production.)`);
  }

  return issues;
}
