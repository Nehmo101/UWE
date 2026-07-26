import type { CanonicalStatus, Visibility } from "./generated/prisma/client";
import type { UweSystemSettingsUpdate } from "./settings-service";
import {
  MAIL_INBOX_LIMIT_MAX,
  MAIL_INBOX_LIMIT_MIN,
  normalizeMailSyncInterval,
} from "./mail-settings";
import { validateAppSettingsSection } from "./settings-validation-app";
import {
  collectUnknownKeys,
  isRecord,
  requireBoolean,
  requireEnum,
  requireSafePathString,
  validateSection,
} from "./settings-validation-helpers";

const VISIBILITY_VALUES = new Set<Visibility>([
  "private",
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
  "prepared",
  "played",
  "canon",
  "deprecated",
  "contradictory",
  "non_canon",
  "discarded",
]);

const TOP_LEVEL_KEYS = new Set([
  "app",
  "worlds",
  "campaigns",
  "portal",
  "ai",
  "mail",
  "imageStudio",
  "storage",
  "backup",
  "briefing",
  "privacy",
  "auth",
  "maintenance",
]);

const WORLDS_KEYS = new Set(["defaultVisibility", "defaultCanonicalStatus"]);
const CAMPAIGNS_KEYS = new Set(["inheritWorldDefaults"]);
const PORTAL_KEYS = new Set(["portalEnabled", "guestAccessEnabled", "publicSharingEnabled"]);
const AI_KEYS = new Set(["localOnlyMode", "enabled", "generalChatSystemPrompt"]);
const MAIL_KEYS = new Set([
  "enabled",
  "fromDisplayName",
  "logBody",
  "inboxLimit",
  "autoSyncEnabled",
  "autoSyncIntervalMinutes",
]);
const IMAGE_STUDIO_KEYS = new Set([
  "enabled",
  "defaultProviderMode",
  "allowCloud",
  "backgroundRemovalEnabled",
]);
const STORAGE_KEYS = new Set(["uploadsPath", "exportsPath"]);
const BACKUP_KEYS = new Set(["backupsPath", "autoBackupEnabled", "retentionCount"]);
const BRIEFING_KEYS = new Set(["autoBriefingEnabled", "time"]);
const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const PRIVACY_KEYS = new Set(["maskSecretsInUi", "restrictPublicExport"]);
const AUTH_KEYS = new Set([
  "sessionInactivityTimeoutMinutes",
  "passkeysEnabled",
  "googleLoginEnabled",
  "googleClientId",
]);
const MAINTENANCE_KEYS = new Set(["maintenanceMode", "lockPortal", "lockStudio", "message"]);

export interface SettingsValidationResult {
  ok: true;
  value: UweSystemSettingsUpdate;
}

export interface SettingsValidationError {
  ok: false;
  errors: string[];
}

export type ValidateSettingsUpdateResult = SettingsValidationResult | SettingsValidationError;

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
    const appResult = validateAppSettingsSection(body.app);
    errors.push(...appResult.errors);
    if (appResult.app) {
      update.app = appResult.app;
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
      if (key === "generalChatSystemPrompt") {
        if (value !== null && typeof value !== "string") {
          sectionErrors.push("settings.ai.generalChatSystemPrompt muss ein String oder null sein.");
        } else if (typeof value === "string" && value.length > 12000) {
          sectionErrors.push("settings.ai.generalChatSystemPrompt ist zu lang (max. 12000 Zeichen).");
        }
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
      if (body.ai.generalChatSystemPrompt !== undefined) {
        ai.generalChatSystemPrompt =
          typeof body.ai.generalChatSystemPrompt === "string"
            ? body.ai.generalChatSystemPrompt
            : null;
      }
      if (Object.keys(ai).length > 0) {
        update.ai = ai;
      }
    }
  }

  if ("mail" in body) {
    const sectionErrors = validateSection(body.mail, MAIL_KEYS, "settings.mail", (key, value, sectionErrors) => {
      if (key === "enabled" || key === "logBody" || key === "autoSyncEnabled") {
        requireBoolean(value, `settings.mail.${key}`, sectionErrors);
      }
      if (key === "fromDisplayName") {
        if (typeof value !== "string") {
          sectionErrors.push("settings.mail.fromDisplayName muss ein String sein.");
        } else if (value.length > 120) {
          sectionErrors.push("settings.mail.fromDisplayName ist zu lang (max. 120 Zeichen).");
        }
      }
      if (key === "inboxLimit") {
        const limit = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(limit)) {
          sectionErrors.push("settings.mail.inboxLimit muss eine Zahl sein.");
          return;
        }
        const rounded = Math.round(limit);
        if (rounded < MAIL_INBOX_LIMIT_MIN || rounded > MAIL_INBOX_LIMIT_MAX) {
          sectionErrors.push(
            `settings.mail.inboxLimit muss zwischen ${MAIL_INBOX_LIMIT_MIN} und ${MAIL_INBOX_LIMIT_MAX} liegen.`,
          );
        }
      }
      if (key === "autoSyncIntervalMinutes") {
        const minutes = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(minutes) || ![5, 15, 30, 60].includes(Math.round(minutes))) {
          sectionErrors.push("settings.mail.autoSyncIntervalMinutes muss 5, 15, 30 oder 60 sein.");
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
      if (body.mail.inboxLimit !== undefined) {
        mail.inboxLimit = Math.round(body.mail.inboxLimit as number);
      }
      if (body.mail.autoSyncEnabled !== undefined) {
        mail.autoSyncEnabled = body.mail.autoSyncEnabled as boolean;
      }
      if (body.mail.autoSyncIntervalMinutes !== undefined) {
        mail.autoSyncIntervalMinutes = normalizeMailSyncInterval(body.mail.autoSyncIntervalMinutes);
      }
      if (Object.keys(mail).length > 0) {
        update.mail = mail;
      }
    }
  }

  if ("imageStudio" in body) {
    const sectionErrors = validateSection(
      body.imageStudio,
      IMAGE_STUDIO_KEYS,
      "settings.imageStudio",
      (key, value, sectionErrors) => {
        if (
          key === "enabled" ||
          key === "allowCloud" ||
          key === "backgroundRemovalEnabled"
        ) {
          requireBoolean(value, `settings.imageStudio.${key}`, sectionErrors);
        }
        if (key === "defaultProviderMode") {
          if (
            value !== "auto" &&
            value !== "local_rtx" &&
            value !== "cloud"
          ) {
            sectionErrors.push(
              "settings.imageStudio.defaultProviderMode muss auto, local_rtx oder cloud sein.",
            );
          }
        }
      },
    );
    errors.push(...sectionErrors);
    if (sectionErrors.length === 0 && isRecord(body.imageStudio)) {
      const imageStudio: NonNullable<UweSystemSettingsUpdate["imageStudio"]> = {};
      if (body.imageStudio.enabled !== undefined) {
        imageStudio.enabled = body.imageStudio.enabled as boolean;
      }
      if (body.imageStudio.defaultProviderMode !== undefined) {
        imageStudio.defaultProviderMode = body.imageStudio.defaultProviderMode as
          | "auto"
          | "local_rtx"
          | "cloud";
      }
      if (body.imageStudio.allowCloud !== undefined) {
        imageStudio.allowCloud = body.imageStudio.allowCloud as boolean;
      }
      if (body.imageStudio.backgroundRemovalEnabled !== undefined) {
        imageStudio.backgroundRemovalEnabled = body.imageStudio.backgroundRemovalEnabled as boolean;
      }
      if (Object.keys(imageStudio).length > 0) {
        update.imageStudio = imageStudio;
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
      if (key === "retentionCount") {
        const count = typeof value === "number" ? value : Number(value);
        if (![7, 14, 30].includes(count)) {
          sectionErrors.push("settings.backup.retentionCount muss 7, 14 oder 30 sein.");
        }
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
      if (body.backup.retentionCount !== undefined) {
        backup.retentionCount = body.backup.retentionCount as number;
      }
      if (Object.keys(backup).length > 0) {
        update.backup = backup;
      }
    }
  }

  if ("briefing" in body) {
    const sectionErrors = validateSection(
      body.briefing,
      BRIEFING_KEYS,
      "settings.briefing",
      (key, value, sectionErrors) => {
        if (key === "autoBriefingEnabled") {
          requireBoolean(value, "settings.briefing.autoBriefingEnabled", sectionErrors);
        }
        if (key === "time") {
          if (typeof value !== "string" || !TIME_HHMM.test(value)) {
            sectionErrors.push("settings.briefing.time muss im Format HH:MM (00:00–23:59) sein.");
          }
        }
      },
    );
    errors.push(...sectionErrors);
    if (sectionErrors.length === 0 && isRecord(body.briefing)) {
      const briefing: NonNullable<UweSystemSettingsUpdate["briefing"]> = {};
      if (body.briefing.autoBriefingEnabled !== undefined) {
        briefing.autoBriefingEnabled = body.briefing.autoBriefingEnabled as boolean;
      }
      if (body.briefing.time !== undefined) {
        briefing.time = body.briefing.time as string;
      }
      if (Object.keys(briefing).length > 0) {
        update.briefing = briefing;
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

  if ("auth" in body) {
    const sectionErrors = validateSection(body.auth, AUTH_KEYS, "settings.auth", (key, value, sectionErrors) => {
      if (key === "sessionInactivityTimeoutMinutes") {
        const minutes = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(minutes)) {
          sectionErrors.push("settings.auth.sessionInactivityTimeoutMinutes muss eine Zahl sein.");
          return;
        }
        const rounded = Math.round(minutes);
        if (rounded < 0 || rounded > 24 * 60) {
          sectionErrors.push(
            "settings.auth.sessionInactivityTimeoutMinutes muss zwischen 0 und 1440 liegen (0 = deaktiviert).",
          );
        }
        return;
      }
      if (
        (key === "passkeysEnabled" || key === "googleLoginEnabled") &&
        typeof value !== "boolean"
      ) {
        sectionErrors.push(`settings.auth.${key} muss true oder false sein.`);
        return;
      }
      if (key === "googleClientId") {
        if (typeof value !== "string") {
          sectionErrors.push("settings.auth.googleClientId muss ein Text sein.");
          return;
        }
        if (value.trim().length > 200) {
          sectionErrors.push("settings.auth.googleClientId ist zu lang (max. 200 Zeichen).");
        }
      }
    });
    errors.push(...sectionErrors);
    if (sectionErrors.length === 0 && isRecord(body.auth)) {
      const auth: NonNullable<UweSystemSettingsUpdate["auth"]> = {};
      if (body.auth.sessionInactivityTimeoutMinutes !== undefined) {
        auth.sessionInactivityTimeoutMinutes = Math.round(
          body.auth.sessionInactivityTimeoutMinutes as number,
        );
      }
      if (body.auth.passkeysEnabled !== undefined) {
        auth.passkeysEnabled = body.auth.passkeysEnabled as boolean;
      }
      if (body.auth.googleLoginEnabled !== undefined) {
        auth.googleLoginEnabled = body.auth.googleLoginEnabled as boolean;
      }
      if (body.auth.googleClientId !== undefined) {
        auth.googleClientId = (body.auth.googleClientId as string).trim();
      }
      if (Object.keys(auth).length > 0) {
        update.auth = auth;
      }
    }
  }

  if ("maintenance" in body) {
    const sectionErrors = validateSection(
      body.maintenance,
      MAINTENANCE_KEYS,
      "settings.maintenance",
      (key, value, sectionErrors) => {
        if (key === "message") {
          if (typeof value !== "string") {
            sectionErrors.push("settings.maintenance.message muss ein Text sein.");
          }
          return;
        }
        if (typeof value !== "boolean") {
          sectionErrors.push(`settings.maintenance.${key} muss true oder false sein.`);
        }
      },
    );
    errors.push(...sectionErrors);
    if (sectionErrors.length === 0 && isRecord(body.maintenance)) {
      const maintenance: NonNullable<UweSystemSettingsUpdate["maintenance"]> = {};
      for (const key of MAINTENANCE_KEYS) {
        if (key in body.maintenance) {
          (maintenance as Record<string, unknown>)[key] = body.maintenance[key];
        }
      }
      if (Object.keys(maintenance).length > 0) {
        update.maintenance = maintenance;
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: update };
}
