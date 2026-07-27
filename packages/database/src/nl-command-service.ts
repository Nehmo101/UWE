import { UWE_AREAS, type UweArea } from "@uwe/auth";
import { brainPrisma } from "./brain-client";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "./client";
import { logAuditEvent, type AuditRequestContext } from "./audit-log-service";
import { createBugReportService } from "./bug-report-service";
import { getMigrationStatus } from "./migration-status";
import {
  formatEntityResolveError,
  parseAreaToken,
  resolveUserQuery,
  resolveWorldQuery,
  areaLabel,
} from "./nl-command-entity-resolver";
import {
  extractUserQuery,
  extractWorldQuery,
  matchesAny,
} from "./nl-command-text-helpers";
import {
  executeDeleteUserIntent,
  executeListWorldMembersIntent,
  executeResetPasswordIntent,
  parseDeleteUserIntent,
  parseListWorldMembersIntent,
  parseResetPasswordIntent,
} from "./nl-command-user-mgmt-intents";
import { slugifyPageTitle } from "./page-templates";
import { getSecretsStatusSnapshot } from "./secrets-status-service";
import { createSettingsService } from "./settings-service";
import { createUserService } from "./user-service";
import { createWorldCreationService } from "./world-creation-service";

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
  "assign_world",
  "remove_world_membership",
  "disable_user",
  "enable_user",
  "invite_user",
  "create_world",
  "set_user_access",
  "list_world_members",
  "delete_user",
  "reset_password",
] as const;

export type NlCommandIntentName = (typeof NL_COMMAND_INTENTS)[number];

/**
 * Areas whose checkbox may be flipped through the command channel. All four are
 * allowed; the owner flag deliberately is not — owner promotion/demotion never
 * happens over NL commands.
 */
export const NL_AREA_TARGETS = UWE_AREAS;

export type NlAreaTarget = UweArea;

function isAllowedAreaTarget(area: string): area is NlAreaTarget {
  return (NL_AREA_TARGETS as readonly string[]).includes(area);
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
  | { intent: "assign_world"; userQuery: string; worldQuery: string }
  | { intent: "remove_world_membership"; userQuery: string; worldQuery: string }
  | { intent: "disable_user"; userQuery: string }
  | { intent: "enable_user"; userQuery: string }
  | {
      intent: "invite_user";
      email: string;
      displayName?: string;
      areas?: readonly UweArea[];
      worldQuery?: string;
    }
  | { intent: "create_world"; name: string }
  | { intent: "set_user_access"; userQuery: string; area: UweArea; enabled: boolean }
  | { intent: "list_world_members"; worldQuery: string }
  | { intent: "delete_user"; userQuery: string }
  | { intent: "reset_password"; userQuery: string };

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
    case "assign_world":
      return `assign_world:${intent.userQuery}:${intent.worldQuery}`;
    case "remove_world_membership":
      return `remove_world_membership:${intent.userQuery}:${intent.worldQuery}`;
    case "disable_user":
      return `disable_user:${intent.userQuery}`;
    case "enable_user":
      return `enable_user:${intent.userQuery}`;
    case "invite_user":
      return `invite_user:${intent.email}:${intent.displayName ?? ""}:${(intent.areas ?? []).join("+")}:${intent.worldQuery ?? ""}`;
    case "create_world":
      return `create_world:${intent.name}`;
    case "set_user_access":
      return `set_user_access:${intent.userQuery}:${intent.area}:${intent.enabled}`;
    case "list_world_members":
      return `list_world_members:${intent.worldQuery}`;
    case "delete_user":
      return `delete_user:${intent.userQuery}`;
    case "reset_password":
      return `reset_password:${intent.userQuery}`;
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
    intent.intent === "assign_world" ||
    intent.intent === "remove_world_membership" ||
    intent.intent === "disable_user" ||
    intent.intent === "enable_user" ||
    intent.intent === "invite_user" ||
    intent.intent === "create_world" ||
    intent.intent === "set_user_access" ||
    intent.intent === "delete_user" ||
    intent.intent === "reset_password"
  );
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
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
  if (/\b(mitglieder|members|spieler|membership|weltmitglieder)\b/.test(text)) {
    return null;
  }
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

function parseAssignWorldIntent(text: string): NlCommandIntent | null {
  const hasAssignKeyword =
    /\b(assign|set|mach|weise|zuordnen|zuweisen|hinzufuegen|hinzufügen|portalzugriff|portal.?zugang)\b/.test(
      text,
    );
  if (!hasAssignKeyword) {
    return null;
  }

  const worldQuery = extractWorldQuery(text);
  const userQuery = extractUserQuery(text);
  if (!worldQuery || !userQuery) {
    return null;
  }

  return { intent: "assign_world", userQuery, worldQuery };
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

  const areas = extractAreas(text);

  const nameMatch = text.match(/\b(?:name|namens)\s+([a-zäöüß][\wäöüß.-]*)/i);
  const displayName = nameMatch?.[1]?.trim();

  const worldQuery = extractWorldQuery(text) ?? undefined;

  return {
    intent: "invite_user",
    email: emailMatch[0].toLowerCase(),
    displayName,
    areas: areas.length > 0 ? areas : undefined,
    worldQuery,
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

const AREA_TOKENS =
  "portal|spielerportal|wiki|studio|dm[- _]?studio|spielleitung|brain|hirn|wissen|family|familie|haushalt";

/** Every area named anywhere in the command, in the order the areas are defined. */
function extractAreas(text: string): UweArea[] {
  const found = new Set<UweArea>();
  for (const match of text.matchAll(new RegExp(`\\b(${AREA_TOKENS})\\b`, "gi"))) {
    const area = parseAreaToken(match[1] ?? "");
    if (area) {
      found.add(area);
    }
  }
  return UWE_AREAS.filter((area) => found.has(area));
}

/** „nimm X das Studio-Häkchen" vs. „gib X das Studio-Häkchen". */
function extractAccessDirection(text: string): boolean {
  const removing =
    /\b(entzieh|entziehe|entferne|nimm|weg|remove|revoke|deaktiviere|aus|off|ohne|kein|keine|keinen)\b/.test(
      text,
    );
  return !removing;
}

function parseSetUserAccessIntent(text: string): NlCommandIntent | null {
  const hasKeyword = matchesAny(text, [
    /\b(mach|mache|make|setze|set|gib|gebe|grant|erlaube|entzieh|entziehe|entferne|nimm|revoke)\b/,
    /\b(zugang|zugriff|haekchen|häkchen|access|checkbox)\b/,
  ]);
  if (!hasKeyword) {
    return null;
  }

  // World assignment belongs to assign_world, not to an access checkbox.
  if (extractWorldQuery(text)) {
    return null;
  }

  const areas = extractAreas(text);
  const userQuery = extractUserQuery(text);
  if (areas.length !== 1 || !userQuery) {
    // Exactly one area per command — „gib X Portal und Studio" would be two
    // separate access changes and is better said twice than guessed at.
    return null;
  }

  return { intent: "set_user_access", userQuery, area: areas[0], enabled: extractAccessDirection(text) };
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

  const assignWorld = parseAssignWorldIntent(normalized);
  if (assignWorld) candidates.push(assignWorld);

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

  const setUserRole = parseSetUserAccessIntent(normalized);
  if (setUserRole) candidates.push(setUserRole);

  const listWorldMembers = parseListWorldMembersIntent(normalized);
  if (listWorldMembers) candidates.push(listWorldMembers);

  const deleteUser = parseDeleteUserIntent(normalized);
  if (deleteUser) candidates.push(deleteUser);

  const resetPassword = parseResetPasswordIntent(normalized);
  if (resetPassword) candidates.push(resetPassword);

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
    case "assign_world":
      return `${intent.userQuery} der Welt „${intent.worldQuery}“ zuordnen (sieht danach alles darin).`;
    case "remove_world_membership":
      return `${intent.userQuery} aus Welt „${intent.worldQuery}“ entfernen.`;
    case "disable_user":
      return `Benutzer „${intent.userQuery}“ deaktivieren (Sessions werden beendet).`;
    case "enable_user":
      return `Benutzer „${intent.userQuery}“ wieder aktivieren.`;
    case "invite_user":
      return `Einladung an ${intent.email} senden${
        intent.areas?.length ? ` (Zugänge: ${intent.areas.map(areaLabel).join(", ")})` : ""
      }${intent.worldQuery ? ` und Welt „${intent.worldQuery}“ zuordnen` : ""}.`;
    case "create_world":
      return `Neue Welt „${intent.name}“ anlegen (du wirst zugeordnet, Standard-Seiten werden erstellt).`;
    case "set_user_access":
      return `„${intent.userQuery}“ den Zugang ${areaLabel(intent.area)} ${
        intent.enabled ? "geben" : "entziehen"
      } (systemweites Häkchen — keine Welt-Zuordnung).`;
    case "list_world_members":
      return `Mitglieder der Welt „${intent.worldQuery}“ anzeigen (nur Lesen).`;
    case "delete_user":
      return `Benutzer „${intent.userQuery}“ dauerhaft löschen (inkl. Sitzungen und Mitgliedschaften).`;
    case "reset_password":
      return `Passwort für „${intent.userQuery}“ zurücksetzen und ein temporäres Passwort ausgeben.`;
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
    "assign_world",
    "remove_world_membership",
    "disable_user",
    "enable_user",
    "invite_user",
    "set_user_access",
    "delete_user",
    "reset_password",
  ]);
  const worldIntents = new Set(["create_world", "list_world_members"]);
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
            isOwner: user.isOwner,
            access: user.access,
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
        const snapshot = await getSecretsStatusSnapshot(this.db, brainPrisma);
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
      case "assign_world": {
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
        });
        const summary = `${userResult.entity.displayName} ist jetzt der Welt „${worldResult.entity.name}“ zugeordnet.`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          userId: userResult.entity.id,
          worldId: worldResult.entity.id,
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

        // Without an explicit area the invitation defaults to Portal — that is
        // the one area a newly invited person almost always needs.
        const areas = intent.areas?.length ? intent.areas : (["portal"] as const);
        const invite = await userService.createInvite({
          displayName,
          email: intent.email,
          portalAccess: areas.includes("portal"),
          studioAccess: areas.includes("studio"),
          brainAccess: areas.includes("brain"),
          familyAccess: areas.includes("family"),
          actorUserId: ctx.actorUserId,
        });

        let worldAssignment: { worldId: string; worldName: string } | null = null;
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
          });
          worldAssignment = {
            worldId: worldResult.entity.id,
            worldName: worldResult.entity.name,
          };
        }

        const summary = worldAssignment
          ? `Einladung an ${intent.email} erstellt und Welt „${worldAssignment.worldName}“ zugeordnet.`
          : `Einladung an ${intent.email} erstellt.`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          userId: invite.user.id,
          email: intent.email,
          areas,
          worldId: worldAssignment?.worldId,
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
      case "set_user_access": {
        if (!isAllowedAreaTarget(intent.area)) {
          return {
            ok: false,
            error: `Bereich „${intent.area}“ kann nicht per NL-Befehl gesetzt werden. Erlaubt: ${NL_AREA_TARGETS.join(", ")}.`,
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
            error: "Du kannst deine eigenen Zugänge nicht per NL-Befehl ändern.",
            code: "forbidden",
          };
        }

        const userService = createUserService(this.db);
        const target = await userService.getUserById(userResult.entity.id);
        if (!target) {
          return { ok: false, error: "Benutzer nicht gefunden.", code: "invalid" };
        }
        if (target.isOwner) {
          return {
            ok: false,
            error: "Die Zugänge des Owners können nicht per NL-Befehl geändert werden.",
            code: "forbidden",
          };
        }
        if (target.access[intent.area] === intent.enabled) {
          const summary = intent.enabled
            ? `${target.displayName} hat den Zugang ${areaLabel(intent.area)} bereits.`
            : `${target.displayName} hat den Zugang ${areaLabel(intent.area)} ohnehin nicht.`;
          await logNlCommandAudit(this.db, ctx, intent, summary, {
            userId: target.id,
            area: intent.area,
            enabled: intent.enabled,
            changed: false,
          });
          return {
            ok: true,
            intent: intent.intent,
            summary,
            data: {
              userId: target.id,
              displayName: target.displayName,
              area: intent.area,
              enabled: intent.enabled,
              changed: false,
            },
          };
        }

        const accessField = `${intent.area}Access` as const;
        await userService.updateUser(
          target.id,
          { [accessField]: intent.enabled },
          ctx.actorUserId,
        );

        const summary = intent.enabled
          ? `${target.displayName} hat jetzt den Zugang ${areaLabel(intent.area)}.`
          : `${target.displayName} hat den Zugang ${areaLabel(intent.area)} nicht mehr.`;
        await logNlCommandAudit(this.db, ctx, intent, summary, {
          userId: target.id,
          area: intent.area,
          enabled: intent.enabled,
        });
        return {
          ok: true,
          intent: intent.intent,
          summary,
          data: {
            userId: target.id,
            displayName: target.displayName,
            area: intent.area,
            enabled: intent.enabled,
            changed: true,
          },
        };
      }
      case "list_world_members":
        return executeListWorldMembersIntent(this.db, ctx, intent);
      case "delete_user":
        return executeDeleteUserIntent(this.db, ctx, intent);
      case "reset_password":
        return executeResetPasswordIntent(this.db, ctx, intent);
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
