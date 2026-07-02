import type { UweRole, WorldMemberRole } from "@uwe/auth";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "./client";
import { logAuditEvent, type AuditRequestContext } from "./audit-log-service";
import { createBugReportService } from "./bug-report-service";
import { getMigrationStatus } from "./migration-status";
import {
  formatEntityResolveError,
  parseUserRoleToken,
  parseWorldMemberRoleToken,
  resolveUserQuery,
  resolveWorldQuery,
  userRoleLabel,
  worldMemberRoleLabel,
} from "./nl-command-entity-resolver";
import { slugifyPageTitle } from "./page-templates";
import { getSecretsStatusSnapshot } from "./secrets-status-service";
import { createSettingsService } from "./settings-service";
import { createUserService } from "./user-service";
import { createWorldCreationService } from "./world-creation-service";
import type { UserRole } from "./generated/prisma/client";

/** Whitelisted admin command intents — unknown commands are rejected. */
export const NL_COMMAND_INTENTS = [
  "set_maintenance_mode",
  "set_lock_portal",
  "set_lock_studio",
  "list_users",
  "list_worlds",
  "list_open_bugs",
  "get_secrets_status",
  "get_migration_status",
  "list_pending_migrations",
  "assign_world_role",
  "remove_world_membership",
  "disable_user",
  "enable_user",
  "invite_user",
  "create_world",
  "set_user_role",
] as const;

export type NlCommandIntentName = (typeof NL_COMMAND_INTENTS)[number];

/**
 * Global roles assignable via NL command — whitelist derived from the auth role
 * model. "owner" is deliberately excluded: owner promotion/demotion is never
 * allowed through the command channel.
 */
export const NL_GLOBAL_ROLE_TARGETS = [
  "admin",
  "dm",
  "player",
  "readonly",
  "guest",
] as const satisfies readonly UweRole[];

export type NlGlobalRoleTarget = (typeof NL_GLOBAL_ROLE_TARGETS)[number];

function isAllowedGlobalRoleTarget(role: string): role is NlGlobalRoleTarget {
  return (NL_GLOBAL_ROLE_TARGETS as readonly string[]).includes(role);
}

export type NlCommandIntent =
  | {
      intent: "set_maintenance_mode";
      enabled: boolean;
      message?: string;
    }
  | { intent: "set_lock_portal"; enabled: boolean }
  | { intent: "set_lock_studio"; enabled: boolean }
  | { intent: "list_users" }
  | { intent: "list_worlds" }
  | { intent: "list_open_bugs" }
  | { intent: "get_secrets_status" }
  | { intent: "get_migration_status" }
  | { intent: "list_pending_migrations" }
  | { intent: "assign_world_role"; userQuery: string; worldQuery: string; role: WorldMemberRole }
  | { intent: "remove_world_membership"; userQuery: string; worldQuery: string }
  | { intent: "disable_user"; userQuery: string }
  | { intent: "enable_user"; userQuery: string }
  | {
      intent: "invite_user";
      email: string;
      displayName?: string;
      role?: UserRole;
      worldQuery?: string;
      worldRole?: WorldMemberRole;
    }
  | { intent: "create_world"; name: string }
  | { intent: "set_user_role"; userQuery: string; role: UserRole };

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
        | "forbidden"
        | "ambiguous"
        | "invalid";
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
    case "set_lock_portal":
      return `set_lock_portal:${intent.enabled}`;
    case "set_lock_studio":
      return `set_lock_studio:${intent.enabled}`;
    case "list_users":
      return "list_users";
    case "list_worlds":
      return "list_worlds";
    case "list_open_bugs":
      return "list_open_bugs";
    case "get_secrets_status":
      return "get_secrets_status";
    case "get_migration_status":
      return "get_migration_status";
    case "list_pending_migrations":
      return "list_pending_migrations";
    case "assign_world_role":
      return `assign_world_role:${intent.userQuery}:${intent.worldQuery}:${intent.role}`;
    case "remove_world_membership":
      return `remove_world_membership:${intent.userQuery}:${intent.worldQuery}`;
    case "disable_user":
      return `disable_user:${intent.userQuery}`;
    case "enable_user":
      return `enable_user:${intent.userQuery}`;
    case "invite_user":
      return `invite_user:${intent.email}:${intent.displayName ?? ""}:${intent.role ?? ""}:${intent.worldQuery ?? ""}:${intent.worldRole ?? ""}`;
    case "create_world":
      return `create_world:${intent.name}`;
    case "set_user_role":
      return `set_user_role:${intent.userQuery}:${intent.role}`;
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
  return (
    intent.intent === "set_maintenance_mode" ||
    intent.intent === "set_lock_portal" ||
    intent.intent === "set_lock_studio" ||
    intent.intent === "assign_world_role" ||
    intent.intent === "remove_world_membership" ||
    intent.intent === "disable_user" ||
    intent.intent === "enable_user" ||
    intent.intent === "invite_user" ||
    intent.intent === "create_world" ||
    intent.intent === "set_user_role"
  );
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function parseToggleEnabled(text: string): boolean | null {
  const disablePatterns = [
    /\b(deaktivieren|deaktiv|disable|aus|off|beenden|stop|ende|entsperr|entsperren|unlock|freigeb|freischalt)\b/,
  ];
  const enablePatterns = [
    /\b(aktivieren|aktiv|enable|an|on|start|einschalten|sperr|sperren|lock)\b/,
  ];

  if (matchesAny(text, disablePatterns)) {
    return false;
  }
  if (matchesAny(text, enablePatterns)) {
    return true;
  }
  return null;
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
    /\b(deaktivieren|deaktiv|disable|aus|off|beenden|stop|ende)\b/,
    /\b(maintenance off|wartung aus|wartung beenden|wartungsmodus deaktivieren)\b/,
  ];
  const enablePatterns = [
    /\b(aktivieren|aktiv|enable|an|on|start|einschalten)\b/,
    /\b(maintenance on|wartung an|wartung aktivieren|wartungsmodus aktivieren)\b/,
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

function parseLockPortalIntent(text: string): NlCommandIntent | null {
  const scopePatterns = [
    /\b(lock|sperr|sperren|unlock|entsperr)\b.*\b(portal)\b/,
    /\b(portal)\b.*\b(lock|sperr|sperren|unlock|entsperr|sperre)\b/,
  ];
  if (!matchesAny(text, scopePatterns)) {
    return null;
  }

  const enabled = parseToggleEnabled(text);
  if (enabled === null) {
    return null;
  }

  return { intent: "set_lock_portal", enabled };
}

function parseLockStudioIntent(text: string): NlCommandIntent | null {
  const scopePatterns = [
    /\b(lock|sperr|sperren|unlock|entsperr)\b.*\b(studio)\b/,
    /\b(studio)\b.*\b(lock|sperr|sperren|unlock|entsperr|sperre)\b/,
  ];
  if (!matchesAny(text, scopePatterns)) {
    return null;
  }

  const enabled = parseToggleEnabled(text);
  if (enabled === null) {
    return null;
  }

  return { intent: "set_lock_studio", enabled };
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

function parseListOpenBugsIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(list|liste|zeige|show)\b.*\b(open|offene?)\b.*\b(bugs?|fehler|bug.?reports?)\b/,
    /\b(offene?|open)\b.*\b(bugs?|fehler|bug.?reports?)\b/,
    /\b(bugs?|fehler)\b.*\b(offen|open|status)\b/,
    /\bbug.?report\b.*\b(liste|list|status)\b/,
  ];
  return matchesAny(text, patterns) ? { intent: "list_open_bugs" } : null;
}

function parseSecretsStatusIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(secrets?|geheimnis|geheimnisse|schlüssel)\b.*\b(status|zustand|stand|übersicht|snapshot)\b/,
    /\b(status|zustand|stand)\b.*\b(secrets?|geheimnis|geheimnisse)\b/,
    /\bsecrets status\b/,
    /\bgeheimnis.?status\b/,
  ];
  return matchesAny(text, patterns) ? { intent: "get_secrets_status" } : null;
}

function parsePendingMigrationsIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(pending|ausstehende?)\b.*\bmigration/,
    /\bmigration(en)?\b.*\b(pending|ausstehende?)\b/,
    /\bausstehende migrationen\b/,
    /\bliste\b.*\b(pending|ausstehende?)\b.*\bmigration/,
  ];
  return matchesAny(text, patterns) ? { intent: "list_pending_migrations" } : null;
}

function parseMigrationStatusIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(migration|migrationen|migrate|schema)\b.*\b(status|zustand|stand)\b/,
    /\b(status|zustand|stand)\b.*\b(migration|migrationen|schema)\b/,
    /\b(migration status|migrations.?status|migrationsstand)\b/,
  ];
  return matchesAny(text, patterns) ? { intent: "get_migration_status" } : null;
}

function extractWorldQuery(text: string): string | null {
  const quoted = text.match(/\b(?:in|für|for|world|welt)\s+(["'])([^"']+)\1/i);
  if (quoted?.[2]) {
    return quoted[2].trim();
  }
  const plain = text.match(/\b(?:in|für|for|world|welt)\s+([a-z0-9_-]+)/i);
  return plain?.[1]?.trim() ?? null;
}

const USER_QUERY_STOPWORDS = new Set([
  "die",
  "der",
  "das",
  "den",
  "dem",
  "des",
  "the",
  "a",
  "an",
  "ein",
  "eine",
  "einen",
  "einem",
  "einer",
  "user",
  "benutzer",
  "nutzer",
  "account",
  "globale",
  "global",
  "rolle",
  "role",
]);

function isUserQueryStopword(token: string): boolean {
  return USER_QUERY_STOPWORDS.has(token.toLowerCase());
}

function extractUserQuery(text: string): string | null {
  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
  if (emailMatch?.[0]) {
    return emailMatch[0];
  }

  const userLabel = text.match(/\b(?:user|benutzer|nutzer)\s+(\S+)/i);
  if (userLabel?.[1]) {
    return userLabel[1].replace(/[.,;]+$/, "");
  }

  const roleOfUser = text.match(
    /\b(?:rolle\s+von|role\s+of)\s+([a-zäöüß0-9._-]+)/i,
  );
  if (roleOfUser?.[1] && !isUserQueryStopword(roleOfUser[1])) {
    return roleOfUser[1];
  }

  const machUser = text.match(
    /\b(?:mach|mache|make|setze|set|assign|weise)\s+([a-zäöüß0-9._-]+)/i,
  );
  if (machUser?.[1] && !isUserQueryStopword(machUser[1])) {
    return machUser[1];
  }

  const promoteUser = text.match(
    /\b(?:promote|befördere|ernenne)\s+([a-zäöüß0-9._-]+)/i,
  );
  if (promoteUser?.[1] && !isUserQueryStopword(promoteUser[1])) {
    return promoteUser[1];
  }

  const removeUser = text.match(
    /\b(?:entferne|remove|delete)\s+([a-zäöüß0-9._-]+)/i,
  );
  if (removeUser?.[1]) {
    return removeUser[1];
  }

  const disableUser = text.match(
    /\b(?:deaktiviere|disable|sperre)\s+(?:benutzer|user|nutzer|account)?\s*([a-zäöüß0-9._-]+)/i,
  );
  if (disableUser?.[1]) {
    return disableUser[1];
  }

  const enableUser = text.match(
    /\b(?:aktiviere|enable|freischalte)\s+(?:benutzer|user|nutzer|account)?\s*([a-zäöüß0-9._-]+)/i,
  );
  if (enableUser?.[1]) {
    return enableUser[1];
  }

  return null;
}

function extractWorldMemberRole(text: string): WorldMemberRole | null {
  const labeled = text.match(
    /\b(?:zur|als|as|role|rolle)\s+(player|spieler(?:in)?|dm|co[-_]?dm|owner|besitzer|weltbesitzer)\b/i,
  );
  if (labeled?.[1]) {
    return parseWorldMemberRoleToken(labeled[1]);
  }

  const bare = text.match(/\b(player|spieler(?:in)?|dm|co[-_]?dm|owner|besitzer|weltbesitzer)\b/i);
  if (bare?.[1]) {
    return parseWorldMemberRoleToken(bare[1]);
  }

  return null;
}

function parseAssignWorldRoleIntent(text: string): NlCommandIntent | null {
  const hasAssignKeyword = /\b(assign|set|mach|weise|rolle|portalzugriff|portal.?zugang)\b/.test(
    text,
  );
  if (!hasAssignKeyword) {
    return null;
  }

  const worldQuery = extractWorldQuery(text);
  const userQuery = extractUserQuery(text);
  const role = extractWorldMemberRole(text);
  if (!worldQuery || !userQuery || !role) {
    return null;
  }

  return { intent: "assign_world_role", userQuery, worldQuery, role };
}

function parseRemoveWorldMembershipIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(entferne|remove|delete|lösche)\b.*\b(aus|from)\b/,
    /\b(aus|from)\b.*\b(entfernen|remove|delete)\b/,
  ];
  if (!matchesAny(text, patterns)) {
    return null;
  }

  const worldQuery = extractWorldQuery(text);
  const userQuery = extractUserQuery(text);
  if (!worldQuery || !userQuery) {
    return null;
  }

  return { intent: "remove_world_membership", userQuery, worldQuery };
}

function parseDisableUserIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(deaktiviere|deaktivieren|disable|sperre|sperren)\b.*\b(user|benutzer|nutzer|account)\b/,
    /\b(benutzer|user|nutzer|account)\b.*\b(deaktivieren|disable|sperren)\b/,
    /\bdisable user\b/,
  ];
  if (!matchesAny(text, patterns)) {
    return null;
  }

  const userQuery = extractUserQuery(text);
  if (!userQuery) {
    return null;
  }

  return { intent: "disable_user", userQuery };
}

function parseEnableUserIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(aktiviere|aktivieren|enable|freischalte|freischalten)\b.*\b(user|benutzer|nutzer|account)\b/,
    /\b(benutzer|user|nutzer|account)\b.*\b(aktivieren|enable|freischalten)\b/,
    /\benable user\b/,
  ];
  if (!matchesAny(text, patterns)) {
    return null;
  }

  const userQuery = extractUserQuery(text);
  if (!userQuery) {
    return null;
  }

  return { intent: "enable_user", userQuery };
}

function parseInviteUserIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(invite|einladen|lade\s+ein|einladung)\b/,
    /\bneuen?\s+benutzer\b.*\b(einladen|invite|anlegen)\b/,
  ];
  if (!matchesAny(text, patterns)) {
    return null;
  }

  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
  if (!emailMatch?.[0]) {
    return null;
  }

  const roleMatch = text.match(
    /\b(?:als|as|role|rolle)\s+(player|spieler(?:in)?|dm|admin|owner|readonly|guest|gast)\b/i,
  );
  const role = roleMatch?.[1] ? parseUserRoleToken(roleMatch[1]) : undefined;

  const nameMatch = text.match(/\b(?:name|namens)\s+([a-zäöüß][\wäöüß.-]*)/i);
  const displayName = nameMatch?.[1]?.trim();

  const worldQuery = extractWorldQuery(text) ?? undefined;
  const worldRole = worldQuery ? extractWorldMemberRole(text) ?? "player" : undefined;

  return {
    intent: "invite_user",
    email: emailMatch[0].toLowerCase(),
    displayName,
    role: role ?? undefined,
    worldQuery,
    worldRole,
  };
}

/** Extract the new world name from the raw (case-preserving) command text. */
function extractNewWorldName(rawText: string): string | null {
  const quoted = rawText.match(/\b(?:welt|world)\s+(?:namens\s+|named\s+)?(["'])([^"']+)\1/i);
  if (quoted?.[2]) {
    return quoted[2].trim() || null;
  }

  const plain = rawText.match(/\b(?:welt|world)\s+(?:namens\s+|named\s+)?(.+)$/i);
  if (!plain?.[1]) {
    return null;
  }
  const name = plain[1]
    .replace(/[.,;:!?]+$/, "")
    .replace(/\s+(an|ab|anlegen|erstellen|erzeugen|create)$/i, "")
    .trim();
  return name || null;
}

function parseCreateWorldIntent(text: string, rawText: string): NlCommandIntent | null {
  const patterns = [
    /\b(erstelle|erstellen|erstell|lege|anlegen|create|neue?n?|new)\b.*\b(welt|world)\b/,
    /\b(welt|world)\b.*\b(erstellen|anlegen|erzeugen|create)\b/,
  ];
  if (!matchesAny(text, patterns)) {
    return null;
  }

  // Invite/role/membership commands may legitimately mention "Welt"/"world" —
  // those belong to their own intents, never to world creation.
  const conflicting = [
    /\b(invite|einladen|einladung|lade)\b/,
    /\b(rolle|role|weise|zuweisen|assign)\b/,
    /\b(entferne|remove|mitglied|membership)\b/,
    /[\w.+-]+@[\w.-]+\.\w+/,
  ];
  if (matchesAny(text, conflicting)) {
    return null;
  }

  const name = extractNewWorldName(rawText);
  if (!name) {
    return null;
  }

  return { intent: "create_world", name };
}

const GLOBAL_ROLE_TOKENS =
  "admin|administrator(?:in)?|dm|spielleiter(?:in)?|player|spieler(?:in)?|readonly|read[- ]only|guest|gast|owner|besitzer(?:in)?";

function extractGlobalUserRole(text: string): UserRole | null {
  const labeled = text.match(
    new RegExp(
      `\\b(?:zum|zur|zu|als|as|to|auf|rolle)\\s+(?:einem\\s+|einer\\s+|eine\\s+|ein\\s+)?(${GLOBAL_ROLE_TOKENS})\\b`,
      "i",
    ),
  );
  if (labeled?.[1]) {
    return parseUserRoleToken(labeled[1]);
  }

  const make = text.match(
    new RegExp(
      `\\b(?:make|mach|mache)\\s+\\S+\\s+(?:an\\s+|a\\s+)?(${GLOBAL_ROLE_TOKENS})\\b`,
      "i",
    ),
  );
  if (make?.[1]) {
    return parseUserRoleToken(make[1]);
  }

  return null;
}

function parseSetUserRoleIntent(text: string): NlCommandIntent | null {
  const hasKeyword = matchesAny(text, [
    /\b(mach|mache|make|setze|set|promote|befördere|ernenne|ändere|change)\b/,
    /\b(globale?n?\s+rolle|global\s+role)\b/,
  ]);
  if (!hasKeyword) {
    return null;
  }

  // World-scoped role changes belong to assign_world_role, not the global role.
  if (extractWorldQuery(text)) {
    return null;
  }

  const role = extractGlobalUserRole(text);
  const userQuery = extractUserQuery(text);
  if (!role || !userQuery) {
    return null;
  }

  return { intent: "set_user_role", userQuery, role };
}

/**
 * Deterministic intent parser — regex/keyword whitelist only.
 * No LLM involvement; unknown input is rejected.
 */
export function parseCommandIntent(text: string): ParseCommandResult {
  const normalized = normalizeText(text);
  const rawText = text.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { ok: false, error: "Bitte einen Befehl eingeben.", code: "invalid" };
  }

  const candidates: NlCommandIntent[] = [];

  const maintenance = parseMaintenanceIntent(normalized);
  if (maintenance) candidates.push(maintenance);

  const lockPortal = parseLockPortalIntent(normalized);
  if (lockPortal) candidates.push(lockPortal);

  const lockStudio = parseLockStudioIntent(normalized);
  if (lockStudio) candidates.push(lockStudio);

  const users = parseListUsersIntent(normalized);
  if (users) candidates.push(users);

  const worlds = parseListWorldsIntent(normalized);
  if (worlds) candidates.push(worlds);

  const openBugs = parseListOpenBugsIntent(normalized);
  if (openBugs) candidates.push(openBugs);

  const secretsStatus = parseSecretsStatusIntent(normalized);
  if (secretsStatus) candidates.push(secretsStatus);

  const pendingMigrations = parsePendingMigrationsIntent(normalized);
  if (pendingMigrations) candidates.push(pendingMigrations);

  const migration = parseMigrationStatusIntent(normalized);
  if (migration) candidates.push(migration);

  const assignRole = parseAssignWorldRoleIntent(normalized);
  if (assignRole) candidates.push(assignRole);

  const removeMembership = parseRemoveWorldMembershipIntent(normalized);
  if (removeMembership) candidates.push(removeMembership);

  const disableUser = parseDisableUserIntent(normalized);
  if (disableUser) candidates.push(disableUser);

  const enableUser = parseEnableUserIntent(normalized);
  if (enableUser) candidates.push(enableUser);

  const inviteUser = parseInviteUserIntent(normalized);
  if (inviteUser) candidates.push(inviteUser);

  const createWorld = parseCreateWorldIntent(normalized, rawText);
  if (createWorld) candidates.push(createWorld);

  const setUserRole = parseSetUserRoleIntent(normalized);
  if (setUserRole) candidates.push(setUserRole);

  if (candidates.length === 0) {
    return {
      ok: false,
      error:
        "Unbekannter Befehl. Erlaubt: Wartungsmodus, Portal-/Studio-Sperre, Benutzerliste, Weltenliste, offene Bugs, Secrets-/Migrationsstatus, Welt erstellen, Weltrolle zuweisen, globale Rolle setzen, Benutzer einladen/deaktivieren/aktivieren, Mitgliedschaft entfernen.",
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
    case "set_lock_portal":
      return intent.enabled
        ? "Portal-Zugang sperren (Spieler-Wiki blockieren)."
        : "Portal-Sperre aufheben und Portal-Zugang wieder freigeben.";
    case "set_lock_studio":
      return intent.enabled
        ? "Studio-Zugang sperren (Admin-Oberfläche blockieren, Owner ausgenommen)."
        : "Studio-Sperre aufheben und Studio-Zugang wieder freigeben.";
    case "list_users":
      return "Benutzerliste anzeigen (nur Lesen, keine Änderungen).";
    case "list_worlds":
      return "Weltenliste anzeigen (nur Lesen, keine Änderungen).";
    case "list_open_bugs":
      return "Offene Bug-Reports anzeigen (nur Lesen, keine Änderungen).";
    case "get_secrets_status":
      return "Secrets-Status anzeigen (nur Metadaten, keine Klartext-Secrets).";
    case "get_migration_status":
      return "Aktuellen Migrationsstatus der Datenbank anzeigen (nur Lesen).";
    case "list_pending_migrations":
      return "Ausstehende Datenbank-Migrationen anzeigen (nur Lesen).";
    case "assign_world_role":
      return `${intent.userQuery} als ${worldMemberRoleLabel(intent.role)} in „${intent.worldQuery}“ zuweisen (Portal-/Welt-Zugang).`;
    case "remove_world_membership":
      return `${intent.userQuery} aus Welt „${intent.worldQuery}“ entfernen.`;
    case "disable_user":
      return `Benutzer „${intent.userQuery}“ deaktivieren (Sessions werden beendet).`;
    case "enable_user":
      return `Benutzer „${intent.userQuery}“ wieder aktivieren.`;
    case "invite_user":
      return `Einladung an ${intent.email} senden${intent.role ? ` (Rolle: ${intent.role})` : ""}${intent.worldQuery ? ` und Welt „${intent.worldQuery}“ zuweisen` : ""}.`;
    case "create_world":
      return `Neue Welt „${intent.name}“ anlegen (du wirst Welt-Besitzer, Standard-Seiten werden erstellt).`;
    case "set_user_role":
      return `Globale Rolle von „${intent.userQuery}“ auf ${userRoleLabel(intent.role)} setzen (systemweit — keine Welt-Rolle).`;
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
  const userIntents = new Set([
    "assign_world_role",
    "remove_world_membership",
    "disable_user",
    "enable_user",
    "invite_user",
    "set_user_role",
  ]);
  const worldIntents = new Set(["create_world"]);
  const targetType = userIntents.has(intent.intent)
    ? "user"
    : worldIntents.has(intent.intent)
      ? "world"
      : isMutation
        ? "settings"
        : "system";
  const targetId =
    typeof extraMetadata?.userId === "string"
      ? extraMetadata.userId
      : worldIntents.has(intent.intent) && typeof extraMetadata?.worldId === "string"
        ? extraMetadata.worldId
        : undefined;
  await logAuditEvent(db, {
    actorUserId: ctx.actorUserId,
    action: "content_updated",
    targetType,
    targetId,
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
      case "set_lock_portal": {
        const settingsService = createSettingsService(this.db);
        const current = await settingsService.getSettings();
        await settingsService.updateSettings({
          maintenance: {
            ...current.maintenance,
            lockPortal: intent.enabled,
          },
        });
        const summary = intent.enabled
          ? "Portal-Sperre wurde aktiviert."
          : "Portal-Sperre wurde deaktiviert.";
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          enabled: intent.enabled,
        });
        return { ok: true, intent: intent.intent, summary };
      }
      case "set_lock_studio": {
        const settingsService = createSettingsService(this.db);
        const current = await settingsService.getSettings();
        await settingsService.updateSettings({
          maintenance: {
            ...current.maintenance,
            lockStudio: intent.enabled,
          },
        });
        const summary = intent.enabled
          ? "Studio-Sperre wurde aktiviert."
          : "Studio-Sperre wurde deaktiviert.";
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
      case "list_open_bugs": {
        const bugs = await createBugReportService(this.db).listReports({ status: "open" });
        const summary = `${bugs.length} offene Bug-Reports gefunden.`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          count: bugs.length,
        });
        return {
          ok: true,
          intent: intent.intent,
          summary,
          data: bugs.map((bug) => ({
            id: bug.id,
            title: bug.title,
            status: bug.status,
            severity: bug.severity,
            module: bug.module,
            updatedAt: bug.updatedAt,
          })),
        };
      }
      case "get_secrets_status": {
        const snapshot = await getSecretsStatusSnapshot(this.db);
        const summary = snapshot.ok
          ? "Secrets-Status ist in Ordnung (keine kritischen Probleme)."
          : `${snapshot.warnings.filter((warning) => warning.severity === "critical").length} kritische Secrets-Warnung(en).`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          ok: snapshot.ok,
          warningCount: snapshot.warnings.length,
          criticalCount: snapshot.warnings.filter((warning) => warning.severity === "critical")
            .length,
        });
        return { ok: true, intent: intent.intent, summary, data: snapshot };
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
      case "list_pending_migrations": {
        const status = await getMigrationStatus(this.db);
        const pending = status.pendingMigrations;
        const summary =
          pending.length > 0
            ? `${pending.length} ausstehende Migration(en): ${pending.join(", ")}.`
            : "Keine ausstehenden Migrationen.";
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          pendingCount: pending.length,
          failedCount: status.failedMigrations.length,
        });
        return {
          ok: true,
          intent: intent.intent,
          summary,
          data: {
            ok: status.ok,
            pendingMigrations: pending,
            failedMigrations: status.failedMigrations,
            appliedCount: status.appliedCount,
          },
        };
      }
      case "assign_world_role": {
        const userResult = await resolveUserQuery(this.db, intent.userQuery);
        if (!userResult.ok) {
          return {
            ok: false,
            error: formatEntityResolveError("Benutzer", userResult),
            code: userResult.code === "ambiguous" ? "ambiguous" : "invalid",
          };
        }
        const worldResult = await resolveWorldQuery(this.db, intent.worldQuery);
        if (!worldResult.ok) {
          return {
            ok: false,
            error: formatEntityResolveError("Welt", worldResult),
            code: worldResult.code === "ambiguous" ? "ambiguous" : "invalid",
          };
        }

        const userService = createUserService(this.db);
        const membership = await userService.upsertWorldMembership({
          userId: userResult.entity.id,
          worldId: worldResult.entity.id,
          role: intent.role,
        });
        const summary = `${userResult.entity.displayName} ist jetzt ${worldMemberRoleLabel(intent.role)} in „${worldResult.entity.name}“.`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          userId: userResult.entity.id,
          worldId: worldResult.entity.id,
          role: intent.role,
          membershipId: membership.id,
        });
        return {
          ok: true,
          intent: intent.intent,
          summary,
          data: {
            user: {
              id: userResult.entity.id,
              displayName: userResult.entity.displayName,
              email: userResult.entity.email,
            },
            world: worldResult.entity,
            role: intent.role,
            membershipId: membership.id,
          },
        };
      }
      case "remove_world_membership": {
        const userResult = await resolveUserQuery(this.db, intent.userQuery);
        if (!userResult.ok) {
          return {
            ok: false,
            error: formatEntityResolveError("Benutzer", userResult),
            code: userResult.code === "ambiguous" ? "ambiguous" : "invalid",
          };
        }
        const worldResult = await resolveWorldQuery(this.db, intent.worldQuery);
        if (!worldResult.ok) {
          return {
            ok: false,
            error: formatEntityResolveError("Welt", worldResult),
            code: worldResult.code === "ambiguous" ? "ambiguous" : "invalid",
          };
        }

        try {
          await createUserService(this.db).removeWorldMembership(
            userResult.entity.id,
            worldResult.entity.id,
          );
        } catch (error) {
          if (error instanceof Error && error.message === "MEMBERSHIP_NOT_FOUND") {
            return {
              ok: false,
              error: `${userResult.entity.displayName} ist kein Mitglied von „${worldResult.entity.name}“.`,
              code: "invalid",
            };
          }
          throw error;
        }

        const summary = `${userResult.entity.displayName} wurde aus „${worldResult.entity.name}“ entfernt.`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          userId: userResult.entity.id,
          worldId: worldResult.entity.id,
        });
        return {
          ok: true,
          intent: intent.intent,
          summary,
          data: {
            userId: userResult.entity.id,
            worldId: worldResult.entity.id,
          },
        };
      }
      case "disable_user": {
        const userResult = await resolveUserQuery(this.db, intent.userQuery);
        if (!userResult.ok) {
          return {
            ok: false,
            error: formatEntityResolveError("Benutzer", userResult),
            code: userResult.code === "ambiguous" ? "ambiguous" : "invalid",
          };
        }

        try {
          await createUserService(this.db).disableUser(userResult.entity.id, ctx.actorUserId);
        } catch (error) {
          if (error instanceof Error) {
            if (error.message === "CANNOT_DISABLE_SELF") {
              return { ok: false, error: "Du kannst deinen eigenen Account nicht deaktivieren.", code: "forbidden" };
            }
            if (error.message === "LAST_OWNER") {
              return { ok: false, error: "Der letzte aktive Owner kann nicht deaktiviert werden.", code: "forbidden" };
            }
          }
          throw error;
        }

        const summary = `Benutzer „${userResult.entity.displayName}“ wurde deaktiviert.`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          userId: userResult.entity.id,
        });
        return {
          ok: true,
          intent: intent.intent,
          summary,
          data: { userId: userResult.entity.id, displayName: userResult.entity.displayName },
        };
      }
      case "enable_user": {
        const userResult = await resolveUserQuery(this.db, intent.userQuery);
        if (!userResult.ok) {
          return {
            ok: false,
            error: formatEntityResolveError("Benutzer", userResult),
            code: userResult.code === "ambiguous" ? "ambiguous" : "invalid",
          };
        }

        await createUserService(this.db).enableUser(userResult.entity.id, ctx.actorUserId);
        const summary = `Benutzer „${userResult.entity.displayName}“ wurde aktiviert.`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          userId: userResult.entity.id,
        });
        return {
          ok: true,
          intent: intent.intent,
          summary,
          data: { userId: userResult.entity.id, displayName: userResult.entity.displayName },
        };
      }
      case "invite_user": {
        const userService = createUserService(this.db);
        const existing = await this.db.user.findUnique({
          where: { email: intent.email },
          select: { id: true, displayName: true, status: true },
        });
        if (existing) {
          return {
            ok: false,
            error: `Ein Benutzer mit der E-Mail ${intent.email} existiert bereits (${existing.displayName}, Status: ${existing.status}).`,
            code: "invalid",
          };
        }

        const displayName =
          intent.displayName?.trim() ||
          intent.email.split("@")[0]?.replace(/[._-]+/g, " ") ||
          intent.email;

        const invite = await userService.createInvite({
          displayName,
          email: intent.email,
          role: intent.role ?? "player",
          actorUserId: ctx.actorUserId,
        });

        let worldAssignment: { worldId: string; worldName: string; role: WorldMemberRole } | null =
          null;
        if (intent.worldQuery) {
          const worldResult = await resolveWorldQuery(this.db, intent.worldQuery);
          if (!worldResult.ok) {
            return {
              ok: false,
              error: formatEntityResolveError("Welt", worldResult),
              code: worldResult.code === "ambiguous" ? "ambiguous" : "invalid",
            };
          }
          await userService.upsertWorldMembership({
            userId: invite.user.id,
            worldId: worldResult.entity.id,
            role: intent.worldRole ?? "player",
          });
          worldAssignment = {
            worldId: worldResult.entity.id,
            worldName: worldResult.entity.name,
            role: intent.worldRole ?? "player",
          };
        }

        const summary = worldAssignment
          ? `Einladung an ${intent.email} erstellt und Welt „${worldAssignment.worldName}“ zugewiesen.`
          : `Einladung an ${intent.email} erstellt.`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          userId: invite.user.id,
          email: intent.email,
          role: intent.role ?? "player",
          worldId: worldAssignment?.worldId,
          worldRole: worldAssignment?.role,
        });
        return {
          ok: true,
          intent: intent.intent,
          summary,
          data: {
            user: invite.user,
            expiresAt: invite.expiresAt.toISOString(),
            worldAssignment,
          },
        };
      }
      case "create_world": {
        const name = intent.name.trim();
        if (!name) {
          return {
            ok: false,
            error: "Bitte einen Namen für die neue Welt angeben.",
            code: "invalid",
          };
        }
        if (name.length > 120) {
          return {
            ok: false,
            error: "Der Weltname ist zu lang (maximal 120 Zeichen).",
            code: "invalid",
          };
        }

        const slug = slugifyPageTitle(name).slice(0, 80) || "welt";
        const existing = await this.db.world.findFirst({
          where: { OR: [{ slug }, { name }] },
          select: { id: true, name: true, slug: true },
        });
        if (existing) {
          return {
            ok: false,
            error: `Eine Welt mit diesem Namen existiert bereits: „${existing.name}“ (Slug: ${existing.slug}). Bitte einen anderen Namen wählen.`,
            code: "invalid",
          };
        }

        const world = await createWorldCreationService(this.db).createWorldForUser(
          ctx.actorUserId,
          { name },
        );
        const summary = `Welt „${world.name}“ wurde erstellt (Slug: ${world.slug}).`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          worldId: world.id,
          slug: world.slug,
          templateId: world.templateId,
          seededPageCount: world.seededPageCount,
        });
        return {
          ok: true,
          intent: intent.intent,
          summary,
          data: {
            id: world.id,
            name: world.name,
            slug: world.slug,
            templateId: world.templateId,
            seededPageCount: world.seededPageCount,
          },
        };
      }
      case "set_user_role": {
        if (!isAllowedGlobalRoleTarget(intent.role)) {
          return {
            ok: false,
            error: `Rolle „${intent.role}“ kann nicht per NL-Befehl vergeben werden. Erlaubt: ${NL_GLOBAL_ROLE_TARGETS.join(", ")}.`,
            code: "forbidden",
          };
        }

        const userResult = await resolveUserQuery(this.db, intent.userQuery);
        if (!userResult.ok) {
          return {
            ok: false,
            error: formatEntityResolveError("Benutzer", userResult),
            code: userResult.code === "ambiguous" ? "ambiguous" : "invalid",
          };
        }

        if (userResult.entity.id === ctx.actorUserId) {
          return {
            ok: false,
            error: "Du kannst deine eigene globale Rolle nicht per NL-Befehl ändern.",
            code: "forbidden",
          };
        }

        const userService = createUserService(this.db);
        const target = await userService.getUserById(userResult.entity.id);
        if (!target) {
          return { ok: false, error: "Benutzer nicht gefunden.", code: "invalid" };
        }
        if (target.role === "owner") {
          return {
            ok: false,
            error: "Die globale Rolle eines Owners kann nicht per NL-Befehl geändert werden.",
            code: "forbidden",
          };
        }
        if (target.role === intent.role) {
          const summary = `${target.displayName} hat bereits die globale Rolle ${userRoleLabel(intent.role)}.`;
          await logNlCommandAudit(this.db, ctx, intent, summary, {
            userId: target.id,
            role: target.role,
            changed: false,
          });
          return {
            ok: true,
            intent: intent.intent,
            summary,
            data: { userId: target.id, displayName: target.displayName, role: target.role, changed: false },
          };
        }

        try {
          await userService.updateUser(target.id, { role: intent.role }, ctx.actorUserId);
        } catch (error) {
          if (error instanceof Error && error.message === "LAST_OWNER_ROLE") {
            return {
              ok: false,
              error: "Der letzte aktive Owner kann seine Rolle nicht verlieren.",
              code: "forbidden",
            };
          }
          throw error;
        }

        const summary = `${target.displayName} hat jetzt die globale Rolle ${userRoleLabel(intent.role)} (systemweit).`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          userId: target.id,
          fromRole: target.role,
          toRole: intent.role,
        });
        return {
          ok: true,
          intent: intent.intent,
          summary,
          data: {
            userId: target.id,
            displayName: target.displayName,
            fromRole: target.role,
            toRole: intent.role,
          },
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
