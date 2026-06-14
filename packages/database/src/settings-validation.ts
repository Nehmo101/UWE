import type { CanonicalStatus, Visibility } from "./generated/prisma/client";
import type { ThemeAppearance, UweSystemSettingsUpdate } from "./settings-service";

const THEME_VALUES = new Set<ThemeAppearance>(["dark", "light", "system"]);

const VISIBILITY_VALUES = new Set<Visibility>([
  "dm_only",
  "player_visible",
  "public",
  "specific_players",
  "unlock_after_session",
  "archived",
]);

const CANONICAL_STATUS_VALUES = new Set<CanonicalStatus>([
  "idea",
  "draft",
  "canon",
  "deprecated",
  "contradictory",
  "non_canon",
]);

const TOP_LEVEL_KEYS = new Set([
  "app",
  "worlds",
  "campaigns",
  "portal",
  "ai",
  "mail",
  "storage",
  "backup",
  "privacy",
]);

const APP_KEYS = new Set(["theme", "favoriteWorldSlug", "lastActiveWorldSlug"]);
const WORLDS_KEYS = new Set(["defaultVisibility", "defaultCanonicalStatus"]);
const CAMPAIGNS_KEYS = new Set(["inheritWorldDefaults"]);
const PORTAL_KEYS = new Set(["portalEnabled", "guestAccessEnabled", "publicSharingEnabled"]);
const AI_KEYS = new Set(["localOnlyMode", "enabled"]);
const MAIL_KEYS = new Set(["enabled", "fromDisplayName", "logBody"]);
const STORAGE_KEYS = new Set(["uploadsPath", "exportsPath"]);
const BACKUP_KEYS = new Set(["backupsPath", "autoBackupEnabled"]);
const PRIVACY_KEYS = new Set(["maskSecretsInUi", "restrictPublicExport"]);

const UNSAFE_PATH_PATTERNS = [
  /\0/,
  /\.\./,
  /[<>"|*?]/,
  /^\s*\/etc\b/i,
  /^\s*\/proc\b/i,
  /^\s*\/sys\b/i,
  /^\s*\/dev\b/i,
  /^\s*C:\\Windows\b/i,
];

export interface SettingsValidationResult {
  ok: true;
  value: UweSystemSettingsUpdate;
}

export interface SettingsValidationError {
  ok: false;
  errors: string[];
}

export type ValidateSettingsUpdateResult = SettingsValidationResult | SettingsValidationError;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectUnknownKeys(
  obj: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      errors.push(`Unbekannter Schlüssel: ${path}.${key}`);
    }
  }
  return errors;
}

function requireBoolean(
  value: unknown,
  path: string,
  errors: string[],
): value is boolean {
  if (typeof value !== "boolean") {
    errors.push(`${path} muss ein Boolean sein.`);
    return false;
  }
  return true;
}

function requireEnum<T extends string>(
  value: unknown,
  allowed: Set<T>,
  path: string,
  errors: string[],
): value is T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    const options = [...allowed].join(", ");
    errors.push(`${path} muss einer der Werte sein: ${options}.`);
    return false;
  }
  return true;
}

function requireSafePathString(
  value: unknown,
  path: string,
  errors: string[],
): value is string {
  if (typeof value !== "string") {
    errors.push(`${path} muss ein String sein.`);
    return false;
  }

  for (const pattern of UNSAFE_PATH_PATTERNS) {
    if (pattern.test(value)) {
      errors.push(`${path} enthält einen nicht zulässigen Pfadwert.`);
      return false;
    }
  }

  return true;
}

function validateSection(
  section: unknown,
  allowedKeys: Set<string>,
  path: string,
  validateField: (key: string, value: unknown, errors: string[]) => void,
): string[] {
  if (!isRecord(section)) {
    return [`${path} muss ein Objekt sein.`];
  }

  const errors = collectUnknownKeys(section, allowedKeys, path);
  for (const [key, value] of Object.entries(section)) {
    if (allowedKeys.has(key)) {
      validateField(key, value, errors);
    }
  }
  return errors;
}

/**
 * Runtime validation for partial system-settings updates.
 * Rejects unknown keys, invalid enums and unsafe path values.
 */
export function validateSettingsUpdate(body: unknown): ValidateSettingsUpdateResult {
  if (!isRecord(body)) {
    return { ok: false, errors: ["Request-Body muss ein JSON-Objekt sein."] };
  }

  const errors = collectUnknownKeys(body, TOP_LEVEL_KEYS, "settings");

  const update: UweSystemSettingsUpdate = {};

  if ("app" in body) {
    const sectionErrors = validateSection(body.app, APP_KEYS, "settings.app", (key, value, sectionErrors) => {
      if (key === "theme") {
        requireEnum(value, THEME_VALUES, "settings.app.theme", sectionErrors);
      }
    });
    errors.push(...sectionErrors);
    if (isRecord(body.app)) {
      const appErrors: string[] = [];
      const app: NonNullable<UweSystemSettingsUpdate["app"]> = {};
      if (body.app.theme !== undefined) {
        if (!requireEnum(body.app.theme, THEME_VALUES, "settings.app.theme", appErrors)) {
          // recorded in appErrors
        } else {
          app.theme = body.app.theme as ThemeAppearance;
        }
      }
      if (body.app.favoriteWorldSlug !== undefined) {
        if (
          body.app.favoriteWorldSlug !== null &&
          typeof body.app.favoriteWorldSlug !== "string"
        ) {
          appErrors.push("settings.app.favoriteWorldSlug muss ein String oder null sein.");
        } else {
          app.favoriteWorldSlug =
            typeof body.app.favoriteWorldSlug === "string"
              ? body.app.favoriteWorldSlug.trim() || null
              : null;
        }
      }
      if (body.app.lastActiveWorldSlug !== undefined) {
        if (
          body.app.lastActiveWorldSlug !== null &&
          typeof body.app.lastActiveWorldSlug !== "string"
        ) {
          appErrors.push("settings.app.lastActiveWorldSlug muss ein String oder null sein.");
        } else {
          app.lastActiveWorldSlug =
            typeof body.app.lastActiveWorldSlug === "string"
              ? body.app.lastActiveWorldSlug.trim() || null
              : null;
        }
      }
      errors.push(...appErrors);
      if (appErrors.length === 0 && sectionErrors.length === 0 && Object.keys(app).length > 0) {
        update.app = app;
      }
    }
  }

  if ("worlds" in body) {
    const sectionErrors = validateSection(body.worlds, WORLDS_KEYS, "settings.worlds", (key, value, sectionErrors) => {
      if (key === "defaultVisibility") {
        requireEnum(value, VISIBILITY_VALUES, "settings.worlds.defaultVisibility", sectionErrors);
      }
      if (key === "defaultCanonicalStatus") {
        requireEnum(value, CANONICAL_STATUS_VALUES, "settings.worlds.defaultCanonicalStatus", sectionErrors);
      }
    });
    errors.push(...sectionErrors);
    if (sectionErrors.length === 0 && isRecord(body.worlds)) {
      const worlds: NonNullable<UweSystemSettingsUpdate["worlds"]> = {};
      if (body.worlds.defaultVisibility !== undefined) {
        worlds.defaultVisibility = body.worlds.defaultVisibility as Visibility;
      }
      if (body.worlds.defaultCanonicalStatus !== undefined) {
        worlds.defaultCanonicalStatus = body.worlds.defaultCanonicalStatus as CanonicalStatus;
      }
      if (Object.keys(worlds).length > 0) {
        update.worlds = worlds;
      }
    }
  }

  if ("campaigns" in body) {
    const sectionErrors = validateSection(
      body.campaigns,
      CAMPAIGNS_KEYS,
      "settings.campaigns",
      (key, value, sectionErrors) => {
        if (key === "inheritWorldDefaults") {
          requireBoolean(value, "settings.campaigns.inheritWorldDefaults", sectionErrors);
        }
      },
    );
    errors.push(...sectionErrors);
    if (
      sectionErrors.length === 0 &&
      isRecord(body.campaigns) &&
      body.campaigns.inheritWorldDefaults !== undefined
    ) {
      update.campaigns = {
        inheritWorldDefaults: body.campaigns.inheritWorldDefaults as boolean,
      };
    }
  }

  if ("portal" in body) {
    const sectionErrors = validateSection(body.portal, PORTAL_KEYS, "settings.portal", (key, value, sectionErrors) => {
      if (key === "portalEnabled") {
        requireBoolean(value, "settings.portal.portalEnabled", sectionErrors);
      }
      if (key === "guestAccessEnabled") {
        requireBoolean(value, "settings.portal.guestAccessEnabled", sectionErrors);
      }
      if (key === "publicSharingEnabled") {
        requireBoolean(value, "settings.portal.publicSharingEnabled", sectionErrors);
      }
    });
    errors.push(...sectionErrors);
    if (sectionErrors.length === 0 && isRecord(body.portal)) {
      const portal: NonNullable<UweSystemSettingsUpdate["portal"]> = {};
      if (body.portal.portalEnabled !== undefined) {
        portal.portalEnabled = body.portal.portalEnabled as boolean;
      }
      if (body.portal.guestAccessEnabled !== undefined) {
        portal.guestAccessEnabled = body.portal.guestAccessEnabled as boolean;
      }
      if (body.portal.publicSharingEnabled !== undefined) {
        portal.publicSharingEnabled = body.portal.publicSharingEnabled as boolean;
      }
      if (Object.keys(portal).length > 0) {
        update.portal = portal;
      }
    }
  }

  if ("ai" in body) {
    const sectionErrors = validateSection(body.ai, AI_KEYS, "settings.ai", (key, value, sectionErrors) => {
      if (key === "localOnlyMode" || key === "enabled") {
        requireBoolean(value, `settings.ai.${key}`, sectionErrors);
      }
    });
    errors.push(...sectionErrors);
    if (sectionErrors.length === 0 && isRecord(body.ai)) {
      const ai: NonNullable<UweSystemSettingsUpdate["ai"]> = {};
      if (body.ai.localOnlyMode !== undefined) {
        ai.localOnlyMode = body.ai.localOnlyMode as boolean;
      }
      if (body.ai.enabled !== undefined) {
        ai.enabled = body.ai.enabled as boolean;
      }
      if (Object.keys(ai).length > 0) {
        update.ai = ai;
      }
    }
  }

  if ("mail" in body) {
    const sectionErrors = validateSection(body.mail, MAIL_KEYS, "settings.mail", (key, value, sectionErrors) => {
      if (key === "enabled" || key === "logBody") {
        requireBoolean(value, `settings.mail.${key}`, sectionErrors);
      }
      if (key === "fromDisplayName") {
        if (typeof value !== "string") {
          sectionErrors.push("settings.mail.fromDisplayName muss ein String sein.");
        } else if (value.length > 120) {
          sectionErrors.push("settings.mail.fromDisplayName ist zu lang (max. 120 Zeichen).");
        }
      }
    });
    errors.push(...sectionErrors);
    if (sectionErrors.length === 0 && isRecord(body.mail)) {
      const mail: NonNullable<UweSystemSettingsUpdate["mail"]> = {};
      if (body.mail.enabled !== undefined) {
        mail.enabled = body.mail.enabled as boolean;
      }
      if (body.mail.fromDisplayName !== undefined) {
        mail.fromDisplayName = body.mail.fromDisplayName as string;
      }
      if (body.mail.logBody !== undefined) {
        mail.logBody = body.mail.logBody as boolean;
      }
      if (Object.keys(mail).length > 0) {
        update.mail = mail;
      }
    }
  }

  if ("storage" in body) {
    const sectionErrors = validateSection(body.storage, STORAGE_KEYS, "settings.storage", (key, value, sectionErrors) => {
      if (key === "uploadsPath" || key === "exportsPath") {
        requireSafePathString(value, `settings.storage.${key}`, sectionErrors);
      }
    });
    errors.push(...sectionErrors);
    if (sectionErrors.length === 0 && isRecord(body.storage)) {
      const storage: NonNullable<UweSystemSettingsUpdate["storage"]> = {};
      if (body.storage.uploadsPath !== undefined) {
        storage.uploadsPath = body.storage.uploadsPath as string;
      }
      if (body.storage.exportsPath !== undefined) {
        storage.exportsPath = body.storage.exportsPath as string;
      }
      if (Object.keys(storage).length > 0) {
        update.storage = storage;
      }
    }
  }

  if ("backup" in body) {
    const sectionErrors = validateSection(body.backup, BACKUP_KEYS, "settings.backup", (key, value, sectionErrors) => {
      if (key === "backupsPath") {
        requireSafePathString(value, "settings.backup.backupsPath", sectionErrors);
      }
      if (key === "autoBackupEnabled") {
        requireBoolean(value, "settings.backup.autoBackupEnabled", sectionErrors);
      }
    });
    errors.push(...sectionErrors);
    if (sectionErrors.length === 0 && isRecord(body.backup)) {
      const backup: NonNullable<UweSystemSettingsUpdate["backup"]> = {};
      if (body.backup.backupsPath !== undefined) {
        backup.backupsPath = body.backup.backupsPath as string;
      }
      if (body.backup.autoBackupEnabled !== undefined) {
        backup.autoBackupEnabled = body.backup.autoBackupEnabled as boolean;
      }
      if (Object.keys(backup).length > 0) {
        update.backup = backup;
      }
    }
  }

  if ("privacy" in body) {
    const sectionErrors = validateSection(body.privacy, PRIVACY_KEYS, "settings.privacy", (key, value, sectionErrors) => {
      if (key === "restrictPublicExport") {
        requireBoolean(value, "settings.privacy.restrictPublicExport", sectionErrors);
      }
      if (key === "maskSecretsInUi") {
        if (!requireBoolean(value, "settings.privacy.maskSecretsInUi", sectionErrors)) {
          return;
        }
        if (value === false) {
          sectionErrors.push(
            "settings.privacy.maskSecretsInUi kann nicht deaktiviert werden — der Server erzwingt Maskierung von Secrets in der UI.",
          );
        }
      }
    });
    errors.push(...sectionErrors);
    if (sectionErrors.length === 0 && isRecord(body.privacy)) {
      const privacy: NonNullable<UweSystemSettingsUpdate["privacy"]> = {};
      if (body.privacy.restrictPublicExport !== undefined) {
        privacy.restrictPublicExport = body.privacy.restrictPublicExport as boolean;
      }
      if (body.privacy.maskSecretsInUi !== undefined) {
        privacy.maskSecretsInUi = body.privacy.maskSecretsInUi as boolean;
      }
      if (Object.keys(privacy).length > 0) {
        update.privacy = privacy;
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: update };
}
