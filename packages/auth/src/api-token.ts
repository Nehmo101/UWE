
export const API_TOKEN_PREFIX = "uwe_";
export const API_TOKEN_PREFIX_DISPLAY_LENGTH = 12;

/** Narrow API token scopes — each maps to specific route families. */
export const API_TOKEN_SCOPES = [
  "health_read",
  "worlds_read",
  "export_read",
  "webhooks_manage",
  "ai_invoke",
  "mail_read",
  "mail_send",
  "settings_read",
  "settings_write",
  "admin_read",
  "admin_write",
  "backup_read",
  "backup_write",
  "family_read",
  "family_write",
  "family_calendar",
] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

export const API_TOKEN_SCOPE_LABELS: Record<ApiTokenScope, string> = {
  health_read: "Health-Checks lesen",
  worlds_read: "Welten lesen",
  export_read: "Exporte lesen",
  webhooks_manage: "Webhooks verwalten",
  ai_invoke: "KI/Brain aufrufen",
  mail_read: "Mail-Logs lesen",
  mail_send: "Mail senden",
  settings_read: "Einstellungen lesen",
  settings_write: "Einstellungen ändern",
  admin_read: "Admin-Status lesen",
  admin_write: "Admin-Aktionen ausführen",
  backup_read: "Backups lesen",
  backup_write: "Backups erstellen/wiederherstellen",
  family_read: "Family lesen (Kalender, Einkauf, Rezepte, Mitglieder)",
  family_write: "Family ändern (Termine, Einkauf, Akte)",
  family_calendar: "Family-Kalender-Abos verwalten",
};

const ADMIN_SCOPES = new Set<ApiTokenScope>(["admin_read", "admin_write"]);

export function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function isApiTokenFormat(token: string): boolean {
  return token.startsWith(API_TOKEN_PREFIX) && token.length > API_TOKEN_PREFIX.length + 16;
}

export function hasApiTokenScope(
  grantedScopes: readonly ApiTokenScope[],
  required: ApiTokenScope | readonly ApiTokenScope[],
): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((scope) => grantedScopes.includes(scope));
}

/** Admin scopes are the owner's to hand out — nobody else can mint them. */
export function assertAdminScopesForOwner(
  isOwner: boolean,
  scopes: readonly ApiTokenScope[],
): void {
  const needsAdmin = scopes.some((scope) => ADMIN_SCOPES.has(scope));
  if (needsAdmin && !isOwner) {
    throw new Error("Admin scopes require the owner.");
  }
}

export function maskSecretValue(value: string, visiblePrefix = 4, visibleSuffix = 0): string {
  if (!value) {
    return "";
  }
  if (value.length <= visiblePrefix + visibleSuffix + 3) {
    return "••••••••";
  }
  const prefix = value.slice(0, visiblePrefix);
  const suffix = visibleSuffix > 0 ? value.slice(-visibleSuffix) : "";
  return `${prefix}…${suffix}`;
}

export function maskTokenForDisplay(prefix: string): string {
  return `${prefix}${"•".repeat(8)}`;
}

export function getApiTokenPrefix(token: string): string {
  return token.slice(0, API_TOKEN_PREFIX_DISPLAY_LENGTH);
}
