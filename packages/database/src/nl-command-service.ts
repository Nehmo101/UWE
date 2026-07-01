import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "./client";
import { logAuditEvent, type AuditRequestContext } from "./audit-log-service";
import { getMigrationStatus } from "./migration-status";
import { createSettingsService } from "./settings-service";
import { createUserService } from "./user-service";

/** Whitelisted admin command intents — unknown commands are rejected. */
export const NL_COMMAND_INTENTS = [
  "set_maintenance_mode",
  "list_users",
  "list_worlds",
  "get_migration_status",
] as const;

export type NlCommandIntentName = (typeof NL_COMMAND_INTENTS)[number];

export type NlCommandIntent =
  | {
      intent: "set_maintenance_mode";
      enabled: boolean;
      message?: string;
    }
  | { intent: "list_users" }
  | { intent: "list_worlds" }
  | { intent: "get_migration_status" };

export type ParseCommandResult =
  | { ok: true; intent: NlCommandIntent; requiresConfirmation: boolean }
  | { ok: false; error: string; code: "unknown_command" | "ambiguous" | "invalid" };

export interface NlCommandExecutionContext {
  actorUserId: string;
  request?: AuditRequestContext | null;
}

export type NlCommandExecutionResult =
  | {
      ok: true;
      intent: NlCommandIntentName;
      summary: string;
      data?: unknown;
    }
  | {
      ok: false;
      error: string;
      code:
        | "unknown_command"
        | "confirmation_required"
        | "confirmation_invalid"
        | "confirmation_expired"
        | "forbidden";
    };

const CONFIRMATION_TTL_MS = 5 * 60_000;

function confirmationSalt(): string {
  return (
    process.env.NL_COMMAND_CONFIRM_SALT ??
    process.env.AUDIT_HASH_SALT ??
    process.env.AUTH_SECRET ??
    "uwe-nl-command-dev-salt"
  );
}

function canonicalIntentPayload(intent: NlCommandIntent): string {
  switch (intent.intent) {
    case "set_maintenance_mode":
      return `set_maintenance_mode:${intent.enabled}:${intent.message ?? ""}`;
    case "list_users":
      return "list_users";
    case "list_worlds":
      return "list_worlds";
    case "get_migration_status":
      return "get_migration_status";
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}

export function isNlCommandIntentName(value: string): value is NlCommandIntentName {
  return (NL_COMMAND_INTENTS as readonly string[]).includes(value);
}

export function isMutationIntent(intent: NlCommandIntent): boolean {
  return intent.intent === "set_maintenance_mode";
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function parseMaintenanceIntent(text: string): NlCommandIntent | null {
  const maintenancePatterns = [
    /\b(maintenance|wartung|wartungsmodus)\b/,
    /\b(maintenance mode|wartungs.?modus)\b/,
  ];
  if (!matchesAny(text, maintenancePatterns)) {
    return null;
  }

  const disablePatterns = [
    /\b(deaktiv|disable|aus|off|beenden|stop|ende)\b/,
    /\b(maintenance off|wartung aus|wartung beenden)\b/,
  ];
  const enablePatterns = [
    /\b(aktiv|enable|an|on|start|einschalten)\b/,
    /\b(maintenance on|wartung an|wartung aktivieren)\b/,
  ];

  const enabled = matchesAny(text, enablePatterns)
    ? true
    : matchesAny(text, disablePatterns)
      ? false
      : null;

  if (enabled === null) {
    return null;
  }

  const messageMatch = text.match(/(?:nachricht|message)\s*[:\-]\s*(.+)$/i);
  return {
    intent: "set_maintenance_mode",
    enabled,
    message: messageMatch?.[1]?.trim() || undefined,
  };
}

function parseListUsersIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(list|liste|zeige|show)\b.*\b(users?|benutzer|nutzer|accounts?)\b/,
    /\b(benutzer|nutzer)\s*(liste|list|übersicht|overview)\b/,
    /\b(users?|benutzer)\s*(auflisten|anzeigen)\b/,
  ];
  return matchesAny(text, patterns) ? { intent: "list_users" } : null;
}

function parseListWorldsIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(list|liste|zeige|show)\b.*\b(worlds?|welten)\b/,
    /\b(welten|worlds?)\s*(liste|list|übersicht|overview)\b/,
    /\b(welten|worlds?)\s*(auflisten|anzeigen)\b/,
  ];
  return matchesAny(text, patterns) ? { intent: "list_worlds" } : null;
}

function parseMigrationStatusIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(migration|migrationen|migrate|schema)\b.*\b(status|zustand|stand)\b/,
    /\b(status|zustand|stand)\b.*\b(migration|migrationen|schema)\b/,
    /\b(migration status|migrations.?status|migrationsstand)\b/,
    /\b(pending|ausstehende)\b.*\bmigration/,
  ];
  return matchesAny(text, patterns) ? { intent: "get_migration_status" } : null;
}

/**
 * Deterministic intent parser — regex/keyword whitelist only.
 * No LLM involvement; unknown input is rejected.
 */
export function parseCommandIntent(text: string): ParseCommandResult {
  const normalized = normalizeText(text);
  if (!normalized) {
    return { ok: false, error: "Bitte einen Befehl eingeben.", code: "invalid" };
  }

  const candidates: NlCommandIntent[] = [];

  const maintenance = parseMaintenanceIntent(normalized);
  if (maintenance) candidates.push(maintenance);

  const users = parseListUsersIntent(normalized);
  if (users) candidates.push(users);

  const worlds = parseListWorldsIntent(normalized);
  if (worlds) candidates.push(worlds);

  const migration = parseMigrationStatusIntent(normalized);
  if (migration) candidates.push(migration);

  if (candidates.length === 0) {
    return {
      ok: false,
      error:
        "Unbekannter Befehl. Erlaubt: Wartungsmodus, Benutzerliste, Weltenliste, Migrationsstatus.",
      code: "unknown_command",
    };
  }

  const uniqueIntents = new Set(candidates.map((item) => item.intent));
  if (uniqueIntents.size > 1) {
    return {
      ok: false,
      error: "Mehrdeutiger Befehl — bitte präzisieren.",
      code: "ambiguous",
    };
  }

  const intent = candidates[0]!;
  return {
    ok: true,
    intent,
    requiresConfirmation: isMutationIntent(intent),
  };
}

export function buildConfirmationMessage(intent: NlCommandIntent): string {
  switch (intent.intent) {
    case "set_maintenance_mode":
      return intent.enabled
        ? `Wartungsmodus aktivieren${intent.message ? ` (Nachricht: „${intent.message}“)` : ""}. Portal und Studio können gesperrt werden.`
        : "Wartungsmodus deaktivieren und normalen Betrieb wiederherstellen.";
    case "list_users":
      return "Benutzerliste anzeigen (nur Lesen, keine Änderungen).";
    case "list_worlds":
      return "Weltenliste anzeigen (nur Lesen, keine Änderungen).";
    case "get_migration_status":
      return "Aktuellen Migrationsstatus der Datenbank anzeigen (nur Lesen).";
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}

export function issueConfirmationToken(
  intent: NlCommandIntent,
  actorUserId: string,
  issuedAtMs: number = Date.now(),
): string {
  const payload = `${actorUserId}:${issuedAtMs}:${canonicalIntentPayload(intent)}`;
  return createHmac("sha256", confirmationSalt()).update(payload).digest("hex");
}

export function verifyConfirmationToken(
  intent: NlCommandIntent,
  actorUserId: string,
  token: string,
  issuedAtMs: number,
  nowMs: number = Date.now(),
): boolean {
  if (!token?.trim()) {
    return false;
  }

  if (nowMs - issuedAtMs > CONFIRMATION_TTL_MS) {
    return false;
  }

  const expected = issueConfirmationToken(intent, actorUserId, issuedAtMs);
  const provided = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(provided, expectedBuf);
}

async function logNlCommandAudit(
  db: PrismaClient,
  ctx: NlCommandExecutionContext,
  intent: NlCommandIntent,
  summary: string,
  extraMetadata?: Record<string, unknown>,
): Promise<void> {
  const isMutation = isMutationIntent(intent);
  await logAuditEvent(db, {
    actorUserId: ctx.actorUserId,
    action: "content_updated",
    targetType: isMutation ? "settings" : "system",
    request: ctx.request,
    metadata: {
      source: "nl_command",
      intent: intent.intent,
      readOnly: !isMutation,
      summary,
      ...extraMetadata,
    },
  });
}

export class NlCommandService {
  constructor(private readonly db: PrismaClient) {}

  parse(text: string): ParseCommandResult {
    return parseCommandIntent(text);
  }

  buildConfirmation(intent: NlCommandIntent): string {
    return buildConfirmationMessage(intent);
  }

  createConfirmation(intent: NlCommandIntent, actorUserId: string): {
    message: string;
    confirmationToken: string;
    issuedAt: number;
    requiresConfirmation: boolean;
  } {
    const issuedAt = Date.now();
    return {
      message: buildConfirmationMessage(intent),
      confirmationToken: issueConfirmationToken(intent, actorUserId, issuedAt),
      issuedAt,
      requiresConfirmation: isMutationIntent(intent),
    };
  }

  async execute(
    intent: NlCommandIntent,
    ctx: NlCommandExecutionContext,
    options?: {
      confirmationToken?: string | null;
      confirmationIssuedAt?: number | null;
      skipConfirmation?: boolean;
    },
  ): Promise<NlCommandExecutionResult> {
    if (!isNlCommandIntentName(intent.intent)) {
      return { ok: false, error: "Unbekannter Befehl.", code: "unknown_command" };
    }

    const needsConfirmation = isMutationIntent(intent);
    if (needsConfirmation && !options?.skipConfirmation) {
      const token = options?.confirmationToken;
      const issuedAt = options?.confirmationIssuedAt;
      if (!token || issuedAt == null) {
        return {
          ok: false,
          error: "Bestätigung erforderlich, bevor diese Aktion ausgeführt wird.",
          code: "confirmation_required",
        };
      }
      if (!verifyConfirmationToken(intent, ctx.actorUserId, token, issuedAt)) {
        const expired = Date.now() - issuedAt > CONFIRMATION_TTL_MS;
        return {
          ok: false,
          error: expired
            ? "Bestätigung abgelaufen — bitte erneut parsen und bestätigen."
            : "Ungültige Bestätigung.",
          code: expired ? "confirmation_expired" : "confirmation_invalid",
        };
      }
    }

    switch (intent.intent) {
      case "set_maintenance_mode": {
        const settingsService = createSettingsService(this.db);
        const current = await settingsService.getSettings();
        await settingsService.updateSettings({
          maintenance: {
            maintenanceMode: intent.enabled,
            lockPortal: intent.enabled ? current.maintenance.lockPortal : false,
            lockStudio: intent.enabled ? current.maintenance.lockStudio : false,
            message: intent.message ?? current.maintenance.message,
          },
        });
        const summary = intent.enabled
          ? "Wartungsmodus wurde aktiviert."
          : "Wartungsmodus wurde deaktiviert.";
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          enabled: intent.enabled,
        });
        return { ok: true, intent: intent.intent, summary };
      }
      case "list_users": {
        const users = await createUserService(this.db).listUsersForAdmin();
        const summary = `${users.length} Benutzer gefunden.`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          count: users.length,
        });
        return {
          ok: true,
          intent: intent.intent,
          summary,
          data: users.map((user) => ({
            id: user.id,
            displayName: user.displayName,
            email: user.email,
            role: user.role,
            status: user.status,
          })),
        };
      }
      case "list_worlds": {
        const worlds = await this.db.world.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true, createdAt: true },
        });
        const summary = `${worlds.length} Welten gefunden.`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          count: worlds.length,
        });
        return { ok: true, intent: intent.intent, summary, data: worlds };
      }
      case "get_migration_status": {
        const status = await getMigrationStatus(this.db);
        await logNlCommandAudit(this.db, ctx, intent, status.message, {
          ok: status.ok,
          pendingCount: status.pendingMigrations.length,
          failedCount: status.failedMigrations.length,
        });
        return {
          ok: true,
          intent: intent.intent,
          summary: status.message,
          data: status,
        };
      }
      default: {
        const _exhaustive: never = intent;
        return _exhaustive;
      }
    }
  }
}

export function createNlCommandService(db: PrismaClient): NlCommandService {
  return new NlCommandService(db);
}
