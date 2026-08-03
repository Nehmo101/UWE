import { z } from "zod";

export const MIN_SECRET_LENGTH = 16;
export const RECOMMENDED_SECRET_LENGTH = 32;

export const WEAK_SECRET_PATTERNS: RegExp[] = [
  /^change[-_]?me$/i,
  /^changeme$/i,
  /^change-me-in-production$/i,
  /^change-me-in-production-use-openssl-rand-base64-32$/i,
  /^change-me-long-random-secret$/i,
  /^change-me-to-a-long-random-string$/i,
  /^generate-a-random-secret-for-production$/i,
  /^super-secret$/i,
  /^your-secret-here$/i,
  /^dev(elopment)?$/i,
  /^test$/i,
  /^password$/i,
  /^secret$/i,
  /^uwe-dev$/i,
  /^placeholder$/i,
  /^example$/i,
  /^todo$/i,
];

const DEFAULT_DATABASE_URL = "file:./data/uwe.db";
const DEFAULT_MAX_UPLOAD_MB = 50;

const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");

const databaseUrlSchema = z
  .string()
  .min(1, "DATABASE_URL darf nicht leer sein.")
  .refine(
    (value) => value.startsWith("file:") || value.startsWith("libsql:") || value.startsWith("postgres"),
    "DATABASE_URL muss mit file:, libsql: oder postgres beginnen.",
  );

const optionalUrlSchema = z
  .string()
  .url("Ungültige URL.")
  .optional();

const maxUploadMbSchema = z.coerce
  .number()
  .int("MAX_UPLOAD_MB muss eine ganze Zahl sein.")
  .min(1, "MAX_UPLOAD_MB muss mindestens 1 sein.")
  .max(2048, "MAX_UPLOAD_MB darf höchstens 2048 sein.")
  .default(DEFAULT_MAX_UPLOAD_MB);

export interface ResolvedRawEnv {
  NODE_ENV: "development" | "test" | "production";
  DATABASE_URL: string;
  SESSION_SECRET?: string;
  UWE_SETUP_TOKEN?: string;
  ENGINE_BASE_URL?: string;
  ENGINE_SERVICE_TOKEN?: string;
  MAX_UPLOAD_MB: number;
  PUBLIC_BASE_URL?: string;
  AUTH_SECRET?: string;
  PUBLIC_APP_URL?: string;
}

export interface UweEnv {
  nodeEnv: "development" | "test" | "production";
  isProduction: boolean;
  databaseUrl: string;
  sessionSecret: string | null;
  setupToken: string | null;
  engineBaseUrl: string | null;
  engineServiceToken: string | null;
  maxUploadMb: number;
  maxUploadBytes: number;
  publicBaseUrl: string | null;
}

export class EnvValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(formatEnvValidationError(issues));
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizePublicBaseUrl(value: string | undefined): string | undefined {
  const trimmed = trimOrUndefined(value);
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

/**
 * Resolves canonical and legacy env aliases into one normalized shape.
 */
export function resolveRawEnv(env: NodeJS.ProcessEnv = process.env): ResolvedRawEnv {
  const sessionSecret = trimOrUndefined(env.SESSION_SECRET) ?? trimOrUndefined(env.AUTH_SECRET);
  const setupToken = trimOrUndefined(env.UWE_SETUP_TOKEN);
  const engineBaseUrl = trimOrUndefined(env.ENGINE_BASE_URL);
  const engineServiceToken = trimOrUndefined(env.ENGINE_SERVICE_TOKEN);
  const publicBaseUrl =
    normalizePublicBaseUrl(env.PUBLIC_BASE_URL) ?? normalizePublicBaseUrl(env.PUBLIC_APP_URL);
  const databaseUrl = trimOrUndefined(env.DATABASE_URL) ?? DEFAULT_DATABASE_URL;

  const maxUploadParsed = maxUploadMbSchema.safeParse(env.MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB);
  const maxUploadMb = maxUploadParsed.success ? maxUploadParsed.data : DEFAULT_MAX_UPLOAD_MB;

  const nodeEnvParsed = nodeEnvSchema.safeParse(env.NODE_ENV ?? "development");
  const nodeEnv = nodeEnvParsed.success ? nodeEnvParsed.data : "development";

  return {
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: sessionSecret,
    UWE_SETUP_TOKEN: setupToken,
    ENGINE_BASE_URL: engineBaseUrl,
    ENGINE_SERVICE_TOKEN: engineServiceToken,
    MAX_UPLOAD_MB: maxUploadMb,
    PUBLIC_BASE_URL: publicBaseUrl,
    AUTH_SECRET: sessionSecret,
    PUBLIC_APP_URL: publicBaseUrl,
  };
}

export function isWeakSecret(secret: string | undefined | null): boolean {
  const trimmed = secret?.trim();
  if (!trimmed) {
    return true;
  }

  if (trimmed.length < MIN_SECRET_LENGTH) {
    return true;
  }

  return WEAK_SECRET_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function validateSecretField(
  label: string,
  value: string | undefined,
  options: { required: boolean },
): string[] {
  const issues: string[] = [];

  if (!value?.trim()) {
    if (options.required) {
      issues.push(`${label} fehlt.`);
    }
    return issues;
  }

  if (isWeakSecret(value)) {
    issues.push(
      `${label} ist unsicher (Platzhalter, zu kurz oder bekanntes Demo-Passwort). Mindestens ${MIN_SECRET_LENGTH} Zeichen, empfohlen ${RECOMMENDED_SECRET_LENGTH}+.`,
    );
  }

  return issues;
}

function validateEnginePair(raw: ResolvedRawEnv): string[] {
  const hasBaseUrl = Boolean(raw.ENGINE_BASE_URL);
  const hasServiceToken = Boolean(raw.ENGINE_SERVICE_TOKEN);

  if (hasBaseUrl !== hasServiceToken) {
    return ["ENGINE_BASE_URL und ENGINE_SERVICE_TOKEN müssen gemeinsam gesetzt oder beide leer sein."];
  }

  if (hasBaseUrl && raw.ENGINE_BASE_URL) {
    const parsed = optionalUrlSchema.safeParse(raw.ENGINE_BASE_URL);
    if (!parsed.success) {
      return ["ENGINE_BASE_URL ist keine gültige URL."];
    }
  }

  if (hasServiceToken && isWeakSecret(raw.ENGINE_SERVICE_TOKEN)) {
    return ["ENGINE_SERVICE_TOKEN ist unsicher."];
  }

  return [];
}

export function collectEnvValidationIssues(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const raw = resolveRawEnv(env);
  const issues: string[] = [];
  const isProduction = raw.NODE_ENV === "production";

  const databaseParsed = databaseUrlSchema.safeParse(raw.DATABASE_URL);
  if (!databaseParsed.success) {
    issues.push(databaseParsed.error.issues[0]?.message ?? "DATABASE_URL ist ungültig.");
  }

  issues.push(
    ...validateSecretField("SESSION_SECRET", raw.SESSION_SECRET, {
      required: isProduction,
    }),
  );

  issues.push(
    ...validateSecretField("UWE_SETUP_TOKEN", raw.UWE_SETUP_TOKEN, {
      required: isProduction,
    }),
  );

  issues.push(...validateEnginePair(raw));

  if (isProduction && !raw.PUBLIC_BASE_URL) {
    issues.push("PUBLIC_BASE_URL fehlt in Production.");
  }

  if (raw.PUBLIC_BASE_URL) {
    const parsed = optionalUrlSchema.safeParse(raw.PUBLIC_BASE_URL);
    if (!parsed.success) {
      issues.push("PUBLIC_BASE_URL ist keine gültige URL.");
    }
  }

  const maxUploadParsed = maxUploadMbSchema.safeParse(raw.MAX_UPLOAD_MB);
  if (!maxUploadParsed.success) {
    issues.push(maxUploadParsed.error.issues[0]?.message ?? "MAX_UPLOAD_MB ist ungültig.");
  }

  return issues;
}

export function formatEnvValidationError(issues: string[]): string {
  if (issues.length === 0) {
    return "Environment validation failed.";
  }

  return `Environment validation failed:\n- ${issues.join("\n- ")}`;
}

export function parseUweEnv(env: NodeJS.ProcessEnv = process.env): UweEnv {
  const issues = collectEnvValidationIssues(env);
  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  const raw = resolveRawEnv(env);

  return {
    nodeEnv: raw.NODE_ENV,
    isProduction: raw.NODE_ENV === "production",
    databaseUrl: raw.DATABASE_URL,
    sessionSecret: raw.SESSION_SECRET ?? null,
    setupToken: raw.UWE_SETUP_TOKEN ?? null,
    engineBaseUrl: raw.ENGINE_BASE_URL ?? null,
    engineServiceToken: raw.ENGINE_SERVICE_TOKEN ?? null,
    maxUploadMb: raw.MAX_UPLOAD_MB,
    maxUploadBytes: raw.MAX_UPLOAD_MB * 1024 * 1024,
    publicBaseUrl: raw.PUBLIC_BASE_URL ?? null,
  };
}

/**
 * Applies legacy aliases so existing modules reading AUTH_SECRET keep working.
 */
export function syncLegacyEnvAliases(env: NodeJS.ProcessEnv = process.env): void {
  const raw = resolveRawEnv(env);

  if (raw.SESSION_SECRET) {
    env.SESSION_SECRET = raw.SESSION_SECRET;
    env.AUTH_SECRET = raw.SESSION_SECRET;
  }

  if (raw.UWE_SETUP_TOKEN) {
    env.UWE_SETUP_TOKEN = raw.UWE_SETUP_TOKEN;
  }

  if (raw.PUBLIC_BASE_URL) {
    env.PUBLIC_BASE_URL = raw.PUBLIC_BASE_URL;
    env.PUBLIC_APP_URL = raw.PUBLIC_BASE_URL;
  }

  if (raw.ENGINE_BASE_URL) {
    env.ENGINE_BASE_URL = raw.ENGINE_BASE_URL;
  }

  if (raw.ENGINE_SERVICE_TOKEN) {
    env.ENGINE_SERVICE_TOKEN = raw.ENGINE_SERVICE_TOKEN;
  }

  if (raw.DATABASE_URL) {
    env.DATABASE_URL = raw.DATABASE_URL;
  }

  env.MAX_UPLOAD_MB = String(raw.MAX_UPLOAD_MB);
}

/**
 * Validates production env and aborts startup when critical secrets are missing or weak.
 */
export function assertProductionEnvReady(env: NodeJS.ProcessEnv = process.env): UweEnv | null {
  syncLegacyEnvAliases(env);

  const nodeEnv = env.NODE_ENV?.trim() ?? "development";
  if (nodeEnv !== "production") {
    return null;
  }

  return parseUweEnv(env);
}

export function getUweEnvOrNull(env: NodeJS.ProcessEnv = process.env): UweEnv | null {
  try {
    syncLegacyEnvAliases(env);
    return parseUweEnv(env);
  } catch {
    return null;
  }
}
