import { getUweRuntimeConfig, isPublicExposureConfigured } from "./runtime-config";

export type EnvValidationSeverity = "error" | "warning" | "info";

export interface EnvValidationIssue {
  id: string;
  severity: EnvValidationSeverity;
  message: string;
  envKey?: string;
}

const WEAK_AUTH_SECRET_PATTERNS = [
  /^change[-_]?me$/i,
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
      message: "STUDIO_API_TOKEN nicht gesetzt — empfohlen für Backup, Restore, Settings und AI-APIs.",
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
      severity: "warning",
      envKey: "AUTH_REQUIRED",
      message: "AUTH_REQUIRED=true empfohlen, wenn das Portal öffentlich erreichbar ist.",
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

  if (env.AI_INFERENCE_ALLOW_PUBLIC_URL?.trim().toLowerCase() === "true" && runtime.isProduction) {
    issues.push({
      id: "env:inference-public-url",
      severity: "warning",
      envKey: "AI_INFERENCE_ALLOW_PUBLIC_URL",
      message: "AI_INFERENCE_ALLOW_PUBLIC_URL=true in Production — RTX nur im Heimnetz betreiben.",
    });
  }

  if (
    runtime.isProduction &&
    publicExposure &&
    runtime.cloudflareTunnel &&
    runtime.cloudflareAccessEnabled &&
    !env.STUDIO_ACCESS_ALLOWED_EMAILS?.trim() &&
    !env.STUDIO_ACCESS_EMAIL?.trim()
  ) {
    issues.push({
      id: "env:studio-access-allowlist",
      severity: "error",
      envKey: "STUDIO_ACCESS_ALLOWED_EMAILS",
      message:
        "CLOUDFLARE_ACCESS_ENABLED=true — STUDIO_ACCESS_ALLOWED_EMAILS setzen, damit Cf-Access-Header serverseitig geprüft werden.",
    });
  }

  return issues;
}

export function hasBlockingEnvIssues(issues: EnvValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}
