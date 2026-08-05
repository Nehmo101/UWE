import type { PrismaClient } from "./client";
import type { AuditRequestContext } from "./audit-log-service";
import { logAuditEvent } from "./audit-log-service";

/**
 * Oberfläche, auf der eine Anmeldung stattfand. Reines Metadatenfeld im
 * Audit-Log, keine Datenbank-Aufzählung — `family` kam mit der
 * Konto-Selbstverwaltung in Family dazu und brauchte keine Migration.
 */
export type LoginAuditSurface = "studio" | "portal" | "family";

export type LoginAuditReason =
  | "missing_credentials"
  | "rate_limited"
  | "human_verification_failed"
  | "invalid_credentials"
  | "account_inactive"
  | "account_locked"
  | "studio_access_denied"
  | "two_factor_required"
  | "passkey_invalid"
  | "login_method_disabled"
  | "google_oauth_failed"
  | "google_email_unverified"
  | "google_email_unknown"
  | "server_error";

export const LOGIN_AUDIT_REASON_LABELS: Record<LoginAuditReason, string> = {
  missing_credentials: "E-Mail oder Passwort fehlt",
  rate_limited: "Zu viele Anmeldeversuche (Rate-Limit)",
  human_verification_failed: "„Mensch“-Prüfung (Turnstile) fehlgeschlagen",
  invalid_credentials: "Ungültige Anmeldedaten",
  account_inactive: "Konto deaktiviert",
  account_locked: "Konto vorübergehend gesperrt (zu viele Fehlversuche)",
  studio_access_denied: "Kein Studio-Zugriff für diese Rolle",
  two_factor_required: "Passwort ok — 2FA ausstehend",
  passkey_invalid: "Passkey-Anmeldung fehlgeschlagen",
  login_method_disabled: "Anmeldemethode deaktiviert",
  google_oauth_failed: "Google-Anmeldung fehlgeschlagen (OAuth)",
  google_email_unverified: "Google-E-Mail nicht verifiziert",
  google_email_unknown: "Google-E-Mail keinem Konto zugeordnet",
  server_error: "Serverfehler beim Login",
};

export interface LogLoginAttemptInput {
  db: PrismaClient;
  surface: LoginAuditSurface;
  request: AuditRequestContext;
  email?: string | null;
  actorUserId?: string | null;
  sessionId?: string | null;
  reason?: LoginAuditReason;
  httpStatus?: number;
  /** Client-safe error text — never include passwords or tokens. */
  errorMessage?: string | null;
  serverError?: unknown;
  extraMetadata?: Record<string, unknown>;
}

function normalizeLoginEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || null;
}

function sanitizeServerErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 240);
  }
  if (typeof error === "string") {
    return error.slice(0, 240);
  }
  return "Unbekannter Serverfehler";
}

function buildLoginMetadata(input: LogLoginAttemptInput): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    surface: input.surface,
    endpoint: "login",
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.httpStatus !== undefined ? { httpStatus: input.httpStatus } : {}),
    ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
    ...(input.extraMetadata ?? {}),
  };

  const email = normalizeLoginEmail(input.email);
  if (email) {
    metadata.email = email;
  }

  if (input.serverError !== undefined) {
    metadata.serverError = sanitizeServerErrorMessage(input.serverError);
  }

  return metadata;
}

/** Records a login attempt in the audit log. Passwords are never stored (redacted if passed). */
export async function logLoginAttempt(input: LogLoginAttemptInput): Promise<void> {
  const metadata = buildLoginMetadata(input);

  if (input.reason === "rate_limited") {
    await logAuditEvent(input.db, {
      actorUserId: input.actorUserId ?? null,
      action: "rate_limit_hit",
      targetType: "session",
      targetId: input.sessionId ?? null,
      request: input.request,
      metadata,
    });
    return;
  }

  if (input.sessionId || input.reason === undefined) {
    await logAuditEvent(input.db, {
      actorUserId: input.actorUserId ?? null,
      action: "login_success",
      targetType: "session",
      targetId: input.sessionId ?? null,
      request: input.request,
      metadata,
    });
    return;
  }

  await logAuditEvent(input.db, {
    actorUserId: input.actorUserId ?? null,
    action: "login_failed",
    targetType: "session",
    request: input.request,
    metadata,
  });
}

export interface ResolveLoginFailureReasonInput {
  surface: LoginAuditSurface;
  email: string;
  userFound: boolean;
  userActive: boolean;
  passwordValid: boolean;
  studioAccessGranted?: boolean;
}

export function resolveLoginFailureReason(
  input: ResolveLoginFailureReasonInput,
): LoginAuditReason {
  if (!input.userFound || !input.passwordValid) {
    if (input.userFound && !input.userActive) {
      return "account_inactive";
    }
    return "invalid_credentials";
  }

  if (input.surface === "studio" && input.studioAccessGranted === false) {
    return "studio_access_denied";
  }

  return "invalid_credentials";
}
