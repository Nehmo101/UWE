import { createHash } from "node:crypto";
import type { PrismaClient } from "./client";
import type { AuditAction, AuditTargetType } from "./generated/prisma/client";
import { resolveClientIp } from "@uwe/auth";
import { toPrismaJsonValue } from "./json-utils";

const AUDIT_HASH_SALT =
  process.env.AUDIT_HASH_SALT ?? process.env.AUTH_SECRET ?? "uwe-audit-dev-salt";

const SENSITIVE_METADATA_KEYS = new Set([
  "password",
  "passwordhash",
  "resettokenhash",
  "invitetokenhash",
  "twofactorsecret",
  "pass",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "bearer",
  "prompt",
  "systemprompt",
  "system_prompt",
  "userprompt",
  "user_prompt",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "smtp_pass",
  "smtp_password",
  "privatekey",
  "private_key",
  "credential",
  "credentials",
]);

const SENSITIVE_METADATA_PATTERNS = [
  /password[=:]\s*\S+/gi,
  /smtp[_-]?pass(?:word)?[=:]\s*\S+/gi,
  /authorization:\s*\S+/gi,
  /bearer\s+[a-z0-9._-]+/gi,
  /sk-[a-z0-9]{10,}/gi,
];

const MAX_METADATA_STRING_LENGTH = 500;
const MAX_PROMPT_PREVIEW_LENGTH = 80;

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  login_success: "Login erfolgreich",
  login_failed: "Login fehlgeschlagen",
  logout: "Logout",
  setup_owner_created: "Owner eingerichtet",
  user_created: "Benutzer erstellt",
  user_disabled: "Benutzer deaktiviert",
  user_deleted: "Benutzer gelöscht",
  user_enabled: "Benutzer reaktiviert",
  password_reset: "Passwort zurückgesetzt",
  user_role_changed: "Rolle geändert",
  password_changed: "Passwort geändert",
  user_invited: "Benutzer eingeladen",
  content_created: "Inhalt erstellt",
  content_updated: "Inhalt geändert",
  content_deleted: "Inhalt gelöscht",
  visibility_changed: "Sichtbarkeit geändert",
  secret_revealed: "Secret angezeigt",
  import_started: "Import gestartet",
  import_completed: "Import abgeschlossen",
  import_failed: "Import fehlgeschlagen",
  upload_created: "Upload erstellt",
  upload_deleted: "Upload gelöscht",
  ai_request: "KI-Anfrage",
  backup_created: "Backup erstellt",
  restore_started: "Restore gestartet",
  restore_completed: "Restore abgeschlossen",
  authz_denied: "Zugriff verweigert",
  rate_limit_hit: "Rate-Limit erreicht",
  api_token_created: "API-Token erstellt",
  api_token_used: "API-Token verwendet",
  api_token_revoked: "API-Token widerrufen",
  api_token_rotated: "API-Token rotiert",
  webhook_created: "Webhook erstellt",
  webhook_updated: "Webhook aktualisiert",
  webhook_deleted: "Webhook gelöscht",
  webhook_delivered: "Webhook zugestellt",
  webhook_failed: "Webhook fehlgeschlagen",
  mfa_enabled: "2FA aktiviert",
  mfa_disabled: "2FA deaktiviert",
  mfa_challenge_failed: "2FA-Challenge fehlgeschlagen",
  passkey_registered: "Passkey registriert",
  passkey_removed: "Passkey entfernt",
  oauth_linked: "Google-Konto verknüpft",
  oauth_unlinked: "Google-Konto getrennt",
  security_warning_dismissed: "Sicherheitswarnung verworfen",
  host_update_started: "Host-Update gestartet",
  host_update_completed: "Host-Update abgeschlossen",
  host_update_failed: "Host-Update fehlgeschlagen",
  host_restart_started: "Host-Neustart ausgelöst",
  secret_status_viewed: "Secrets-Status eingesehen",
};

export interface AuditRequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface LogAuditEventInput {
  actorUserId?: string | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  worldId?: string | null;
  request?: AuditRequestContext | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogEntryView {
  id: string;
  timestamp: Date;
  actorUserId: string | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string | null;
  worldId: string | null;
  ipHash: string | null;
  userAgentHash: string | null;
  metadataJson: unknown;
}

export interface ListAuditLogOptions {
  actions?: AuditAction[];
  actorUserId?: string;
  worldId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

function hashAuditValue(value: string): string {
  return createHash("sha256")
    .update(`${AUDIT_HASH_SALT}:${value}`)
    .digest("hex")
    .slice(0, 32);
}

export function hashClientIp(ip: string | null | undefined): string | null {
  if (!ip || ip === "unknown") {
    return null;
  }
  return hashAuditValue(ip);
}

export function hashUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent?.trim()) {
    return null;
  }
  return hashAuditValue(userAgent.trim());
}

function normalizeMetadataKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function redactStringValue(key: string, value: string): string {
  let result = value;
  for (const pattern of SENSITIVE_METADATA_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }

  const normalizedKey = normalizeMetadataKey(key);
  if (
    SENSITIVE_METADATA_KEYS.has(normalizedKey) ||
    normalizedKey.includes("password") ||
    normalizedKey.includes("secret") ||
    normalizedKey.includes("token") ||
    normalizedKey.includes("prompt")
  ) {
    return "[REDACTED]";
  }

  if (normalizedKey.includes("prompt") && result.length > MAX_PROMPT_PREVIEW_LENGTH) {
    return `${result.slice(0, MAX_PROMPT_PREVIEW_LENGTH)}…`;
  }

  if (result.length > MAX_METADATA_STRING_LENGTH) {
    return `${result.slice(0, MAX_METADATA_STRING_LENGTH)}…`;
  }

  return result;
}

export function redactAuditMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = normalizeMetadataKey(key);

    if (SENSITIVE_METADATA_KEYS.has(normalizedKey)) {
      redacted[key] = "[REDACTED]";
      continue;
    }

    if (typeof value === "string") {
      redacted[key] = redactStringValue(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      redacted[key] = value.map((item) => {
        if (typeof item === "string") {
          return redactStringValue(key, item);
        }
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return redactAuditMetadata(item as Record<string, unknown>);
        }
        return item;
      });
      continue;
    }

    if (value && typeof value === "object") {
      redacted[key] = redactAuditMetadata(value as Record<string, unknown>);
      continue;
    }

    redacted[key] = value;
  }

  return redacted;
}

export class AuditLogService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Write a security audit entry. Failures are logged to stderr and never
   * thrown — audit logging must not break the action being recorded.
   */
  async log(input: LogAuditEventInput): Promise<void> {
    try {
      const redactedMetadata = redactAuditMetadata(input.metadata ?? null);

      await this.db.auditLog.create({
        data: {
          actorUserId: input.actorUserId ?? null,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId ?? null,
          worldId: input.worldId ?? null,
          ipHash: hashClientIp(input.request?.ip),
          userAgentHash: hashUserAgent(input.request?.userAgent),
          metadataJson: toPrismaJsonValue(redactedMetadata),
        },
      });
    } catch (error) {
      console.error("[uwe] audit log write failed:", error);
    }
  }

  async list(options: ListAuditLogOptions = {}): Promise<AuditLogEntryView[]> {
    const entries = await this.db.auditLog.findMany({
      where: {
        ...(options.actions ? { action: { in: options.actions } } : {}),
        ...(options.actorUserId ? { actorUserId: options.actorUserId } : {}),
        ...(options.worldId ? { worldId: options.worldId } : {}),
        ...(options.from || options.to
          ? {
              timestamp: {
                ...(options.from ? { gte: options.from } : {}),
                ...(options.to ? { lte: options.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { timestamp: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });

    return entries.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      worldId: entry.worldId,
      ipHash: entry.ipHash,
      userAgentHash: entry.userAgentHash,
      metadataJson: entry.metadataJson,
    }));
  }

  async count(options: Omit<ListAuditLogOptions, "limit" | "offset"> = {}): Promise<number> {
    return this.db.auditLog.count({
      where: {
        ...(options.actions ? { action: { in: options.actions } } : {}),
        ...(options.actorUserId ? { actorUserId: options.actorUserId } : {}),
        ...(options.worldId ? { worldId: options.worldId } : {}),
        ...(options.from || options.to
          ? {
              timestamp: {
                ...(options.from ? { gte: options.from } : {}),
                ...(options.to ? { lte: options.to } : {}),
              },
            }
          : {}),
      },
    });
  }
}

export function createAuditLogService(db: PrismaClient): AuditLogService {
  return new AuditLogService(db);
}

/** Convenience wrapper for one-off audit writes. */
export async function logAuditEvent(
  db: PrismaClient,
  input: LogAuditEventInput,
): Promise<void> {
  return createAuditLogService(db).log(input);
}

export function auditRequestFromHeaders(headers: Headers): AuditRequestContext {
  return {
    ip: resolveClientIp(headers),
    userAgent: headers.get("user-agent"),
  };
}
