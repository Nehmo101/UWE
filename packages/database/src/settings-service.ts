import path from "node:path";
import type { CanonicalStatus, Prisma, PrismaClient, Visibility } from "./generated/prisma/client";
import {
  resolveBackupsDirFromEnv,
  resolveDataDir,
  resolveDatabaseFilePath,
  resolveExportsDirFromEnv,
  resolveUploadsDirFromEnv,
} from "@uwe/assets";
import { getMailConfigStatus } from "@uwe/mail";
import { prisma } from "./client";
import {
  mapClientBackgroundToServer,
  normalizeAppThemePreferences,
  type AppThemePreferences,
  type ThemePreferencesRecord,
  type ThemePreferencesScope,
} from "./theme-preferences";

export type ThemeAppearance = "dark" | "light" | "system";

export type BackgroundPattern =
  | "none"
  | "dots"
  | "constellation"
  | "synapse"
  | "parchment"
  | "subtle-noise";

export const BACKGROUND_PATTERN_VALUES: readonly BackgroundPattern[] = [
  "none",
  "dots",
  "constellation",
  "synapse",
  "parchment",
  "subtle-noise",
] as const;

export interface AppSettings {
  theme: ThemeAppearance;
  /** Decorative shell background pattern (CSS-only, performance-safe). */
  backgroundPattern: BackgroundPattern;
  /** Frosted-glass surfaces (backdrop-filter). Off = opaque panels for readability. */
  frostedGlass: boolean;
  /** Subtle UI motion (transitions). Always respects prefers-reduced-motion. */
  motionEnabled: boolean;
  /** Full client theme preferences synced from Studio (per app scope). */
  themePreferences?: AppThemePreferences;
  /** Preferred DnD world slug for /today — never hardcoded; set in settings or env. */
  favoriteWorldSlug?: string | null;
  /** Last actively opened world slug (optional UX hint). */
  lastActiveWorldSlug?: string | null;
}

export interface WorldSettings {
  defaultVisibility: Visibility;
  defaultCanonicalStatus: CanonicalStatus;
}

export interface CampaignSettings {
  inheritWorldDefaults: boolean;
}

export interface PortalSettings {
  portalEnabled: boolean;
  guestAccessEnabled: boolean;
  publicSharingEnabled: boolean;
}

export interface AiProviderKeyPlaceholder {
  id: string;
  label: string;
  configured: boolean;
  source: "env" | "none";
}

export interface AiSettings {
  localOnlyMode: boolean;
  enabled: boolean;
  providerKeyPlaceholders: AiProviderKeyPlaceholder[];
}

export interface StorageSettings {
  uploadsPath: string;
  exportsPath: string;
}

export interface BackupSettings {
  backupsPath: string;
  autoBackupEnabled: boolean;
  /** Number of stored backups to retain (7, 14, or 30). */
  retentionCount: number;
}

export interface PrivacySettings {
  maskSecretsInUi: boolean;
  restrictPublicExport: boolean;
}

export interface MailSmtpStatus {
  host: string | null;
  port: number | null;
  secure: boolean;
  userConfigured: boolean;
  passwordConfigured: boolean;
  fromAddress: string | null;
  configured: boolean;
  useMock: boolean;
  message: string;
}

export interface MailSettings {
  enabled: boolean;
  fromDisplayName: string;
  logBody: boolean;
  smtp: MailSmtpStatus;
}

export interface UweSystemSettings {
  app: AppSettings;
  worlds: WorldSettings;
  campaigns: CampaignSettings;
  portal: PortalSettings;
  ai: AiSettings;
  mail: MailSettings;
  storage: StorageSettings;
  backup: BackupSettings;
  privacy: PrivacySettings;
}

export type UweSystemSettingsUpdate = {
  app?: Partial<AppSettings>;
  worlds?: Partial<WorldSettings>;
  campaigns?: Partial<CampaignSettings>;
  portal?: Partial<PortalSettings>;
  ai?: Partial<Pick<AiSettings, "localOnlyMode" | "enabled">>;
  mail?: Partial<Pick<MailSettings, "enabled" | "fromDisplayName" | "logBody">>;
  storage?: Partial<StorageSettings>;
  backup?: Partial<BackupSettings>;
  privacy?: Partial<PrivacySettings>;
};

const SETTINGS_ID = "default";

function buildMailSettings(
  stored?: Partial<Pick<MailSettings, "enabled" | "fromDisplayName" | "logBody">>,
): MailSettings {
  const smtpStatus = getMailConfigStatus(process.env, {
    enabled: stored?.enabled,
    logBody: stored?.logBody,
  });

  return {
    enabled: stored?.enabled ?? smtpStatus.enabled,
    fromDisplayName: stored?.fromDisplayName?.trim() ?? "",
    logBody: stored?.logBody ?? smtpStatus.logBody,
    smtp: {
      host: smtpStatus.host,
      port: smtpStatus.port,
      secure: smtpStatus.secure,
      userConfigured: smtpStatus.userConfigured,
      passwordConfigured: smtpStatus.passwordConfigured,
      fromAddress: smtpStatus.fromAddress,
      configured: smtpStatus.configured,
      useMock: smtpStatus.useMock,
      message: smtpStatus.message,
    },
  };
}

function normalizeBackgroundPattern(value: unknown): BackgroundPattern {
  if (
    typeof value === "string" &&
    (BACKGROUND_PATTERN_VALUES as readonly string[]).includes(value)
  ) {
    return value as BackgroundPattern;
  }
  return "none";
}

function normalizeAppSettings(app: AppSettings): AppSettings {
  return {
    ...app,
    backgroundPattern: normalizeBackgroundPattern(app.backgroundPattern),
    frostedGlass: app.frostedGlass !== false,
    motionEnabled: app.motionEnabled !== false,
    themePreferences: normalizeAppThemePreferences(app.themePreferences),
  };
}

export const DEFAULT_SYSTEM_SETTINGS: UweSystemSettings = {
  app: {
    theme: "dark",
    backgroundPattern: "none",
    frostedGlass: true,
    motionEnabled: true,
    favoriteWorldSlug: null,
    lastActiveWorldSlug: null,
  },
  worlds: {
    defaultVisibility: "dm_only",
    defaultCanonicalStatus: "draft",
  },
  campaigns: {
    inheritWorldDefaults: true,
  },
  portal: {
    portalEnabled: true,
    guestAccessEnabled: true,
    publicSharingEnabled: true,
  },
  ai: {
    localOnlyMode: false,
    enabled: true,
    providerKeyPlaceholders: buildProviderKeyPlaceholders(),
  },
  mail: buildMailSettings(),
  storage: {
    uploadsPath: "",
    exportsPath: "",
  },
  backup: {
    backupsPath: "",
    autoBackupEnabled: false,
    retentionCount: 14,
  },
  privacy: {
    maskSecretsInUi: true,
    restrictPublicExport: false,
  },
};

function buildProviderKeyPlaceholders(): AiProviderKeyPlaceholder[] {
  const providers: Array<{ id: string; label: string; envKey: string }> = [
    { id: "openai", label: "OpenAI", envKey: "OPENAI_API_KEY" },
    { id: "anthropic", label: "Anthropic", envKey: "ANTHROPIC_API_KEY" },
    { id: "gemini", label: "Google Gemini", envKey: "GEMINI_API_KEY" },
    { id: "openrouter", label: "OpenRouter", envKey: "OPENROUTER_API_KEY" },
  ];

  return providers.map((provider) => {
    const configured = Boolean(process.env[provider.envKey]?.trim());
    return {
      id: provider.id,
      label: provider.label,
      configured,
      source: configured ? "env" : "none",
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeSettings(
  base: UweSystemSettings,
  stored: unknown,
): UweSystemSettings {
  if (!isRecord(stored)) {
    return normalizeSettings(base);
  }

  const merged: UweSystemSettings = {
    app: { ...base.app, ...(isRecord(stored.app) ? (stored.app as unknown as AppSettings) : {}) },
    worlds: {
      ...base.worlds,
      ...(isRecord(stored.worlds) ? (stored.worlds as unknown as WorldSettings) : {}),
    },
    campaigns: {
      ...base.campaigns,
      ...(isRecord(stored.campaigns) ? (stored.campaigns as unknown as CampaignSettings) : {}),
    },
    portal: {
      ...base.portal,
      ...(isRecord(stored.portal) ? (stored.portal as unknown as PortalSettings) : {}),
    },
    ai: {
      ...base.ai,
      ...(isRecord(stored.ai)
        ? {
            localOnlyMode: Boolean((stored.ai as unknown as AiSettings).localOnlyMode),
            enabled: (stored.ai as unknown as AiSettings).enabled ?? base.ai.enabled,
          }
        : {}),
      providerKeyPlaceholders: buildProviderKeyPlaceholders(),
    },
    mail: buildMailSettings(
      isRecord(stored.mail) ? (stored.mail as unknown as MailSettings) : undefined,
    ),
    storage: {
      ...base.storage,
      ...(isRecord(stored.storage) ? (stored.storage as unknown as StorageSettings) : {}),
    },
    backup: {
      ...base.backup,
      ...(isRecord(stored.backup) ? (stored.backup as unknown as BackupSettings) : {}),
    },
    privacy: {
      ...base.privacy,
      ...(isRecord(stored.privacy) ? (stored.privacy as unknown as PrivacySettings) : {}),
    },
  };

  return normalizeSettings(merged);
}

function normalizeSettings(settings: UweSystemSettings): UweSystemSettings {
  return {
    ...settings,
    app: normalizeAppSettings(settings.app),
    storage: {
      uploadsPath: settings.storage.uploadsPath ?? "",
      exportsPath: settings.storage.exportsPath ?? "",
    },
    ai: {
      ...settings.ai,
      providerKeyPlaceholders: buildProviderKeyPlaceholders(),
    },
    mail: buildMailSettings({
      enabled: settings.mail.enabled,
      fromDisplayName: settings.mail.fromDisplayName,
      logBody: settings.mail.logBody,
    }),
    privacy: {
      ...settings.privacy,
      maskSecretsInUi: true,
    },
  };
}

export function sanitizeSettingsForClient(settings: UweSystemSettings): UweSystemSettings {
  const normalized = normalizeSettings(settings);
  return {
    ...normalized,
    ai: {
      ...normalized.ai,
      providerKeyPlaceholders: normalized.ai.providerKeyPlaceholders.map((placeholder) => ({
        ...placeholder,
        configured: placeholder.configured,
      })),
    },
  };
}

export function resolveEffectiveUploadsPath(
  settings: UweSystemSettings,
  baseDir?: string,
): string {
  const configured = settings.storage.uploadsPath.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(baseDir ?? process.cwd(), configured);
  }

  if (process.env.UWE_UPLOADS_ROOT) {
    return process.env.UWE_UPLOADS_ROOT;
  }

  return resolveUploadsDirFromEnv(baseDir);
}

export function resolveEffectiveBackupsPath(
  settings: UweSystemSettings,
  baseDir?: string,
): string {
  const configured = settings.backup.backupsPath.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(baseDir ?? process.cwd(), configured);
  }

  return resolveBackupsDirFromEnv(baseDir);
}

export function resolveEffectiveExportsPath(
  settings: UweSystemSettings,
  baseDir?: string,
): string {
  const configured = settings.storage.exportsPath.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(baseDir ?? process.cwd(), configured);
  }

  return resolveExportsDirFromEnv(baseDir);
}

export type PersistentPathSource = "settings" | "env" | "default";

export interface PersistentPathEntry {
  effectivePath: string;
  source: PersistentPathSource;
  settingsValue: string;
}

export interface PersistentPathConfiguration {
  dataDir: string;
  databaseFile: string | null;
  uploads: PersistentPathEntry;
  backups: PersistentPathEntry;
  exports: PersistentPathEntry;
}

function resolvePathSource(settingsValue: string, envKeys: readonly string[]): PersistentPathSource {
  if (settingsValue.trim()) {
    return "settings";
  }

  for (const key of envKeys) {
    if (process.env[key]?.trim()) {
      return "env";
    }
  }

  return "default";
}

/** Effective persistent paths for Studio settings UI and diagnostics. */
export function getPersistentPathConfiguration(
  settings: UweSystemSettings,
  baseDir?: string,
): PersistentPathConfiguration {
  const base = baseDir ?? process.cwd();

  return {
    dataDir: resolveDataDir(base),
    databaseFile: resolveDatabaseFilePath(base),
    uploads: {
      settingsValue: settings.storage.uploadsPath,
      effectivePath: resolveEffectiveUploadsPath(settings, base),
      source: resolvePathSource(settings.storage.uploadsPath, [
        "UWE_UPLOADS_DIR",
        "UWE_UPLOADS_ROOT",
        "UPLOADS_DIR",
      ]),
    },
    backups: {
      settingsValue: settings.backup.backupsPath,
      effectivePath: resolveEffectiveBackupsPath(settings, base),
      source: resolvePathSource(settings.backup.backupsPath, ["UWE_BACKUP_DIR", "BACKUPS_DIR"]),
    },
    exports: {
      settingsValue: settings.storage.exportsPath,
      effectivePath: resolveEffectiveExportsPath(settings, base),
      source: resolvePathSource(settings.storage.exportsPath, ["UWE_EXPORT_DIR", "EXPORTS_DIR"]),
    },
  };
}

export function isGuestPortalAccessAllowed(
  settings: UweSystemSettings,
  worldGuestModeEnabled: boolean,
): boolean {
  return settings.portal.guestAccessEnabled && worldGuestModeEnabled;
}

export function isPortalGloballyEnabled(settings: UweSystemSettings): boolean {
  return settings.portal.portalEnabled;
}

export function isPublicSharingEnabled(settings: UweSystemSettings): boolean {
  return settings.portal.publicSharingEnabled;
}

export function resolveLocalOnlyMode(settings: UweSystemSettings): boolean {
  if (settings.ai.localOnlyMode) {
    return true;
  }
  return (
    process.env.AI_LOCAL_ONLY === "true" ||
    process.env.AI_DATENSCHUTZ_MODE === "true"
  );
}

export class SettingsService {
  constructor(private readonly db: PrismaClient) {}

  async getSettings(): Promise<UweSystemSettings> {
    const row = await this.db.systemSettings.findUnique({
      where: { id: SETTINGS_ID },
    });

    if (!row) {
      return normalizeSettings(DEFAULT_SYSTEM_SETTINGS);
    }

    return mergeSettings(DEFAULT_SYSTEM_SETTINGS, row.settings);
  }

  async getSettingsForClient(): Promise<UweSystemSettings> {
    return sanitizeSettingsForClient(await this.getSettings());
  }

  async updateSettings(update: UweSystemSettingsUpdate): Promise<UweSystemSettings> {
    const current = await this.getSettings();
    const next: UweSystemSettings = normalizeSettings({
      app: { ...current.app, ...update.app },
      worlds: { ...current.worlds, ...update.worlds },
      campaigns: { ...current.campaigns, ...update.campaigns },
      portal: { ...current.portal, ...update.portal },
      ai: {
        ...current.ai,
        ...update.ai,
        providerKeyPlaceholders: buildProviderKeyPlaceholders(),
      },
      mail: buildMailSettings({
        enabled: update.mail?.enabled ?? current.mail.enabled,
        fromDisplayName: update.mail?.fromDisplayName ?? current.mail.fromDisplayName,
        logBody: update.mail?.logBody ?? current.mail.logBody,
      }),
      storage: { ...current.storage, ...update.storage },
      backup: { ...current.backup, ...update.backup },
      privacy: { ...current.privacy, ...update.privacy },
    });

    await this.db.systemSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        settings: next as unknown as Prisma.InputJsonValue,
      },
      update: {
        settings: next as unknown as Prisma.InputJsonValue,
      },
    });

    return next;
  }

  async getWorldDefaults(): Promise<WorldSettings> {
    const settings = await this.getSettings();
    return settings.worlds;
  }
}

export function createSettingsService(db?: PrismaClient): SettingsService {
  return new SettingsService(db ?? prisma);
}

export async function getSystemSettings(db?: PrismaClient): Promise<UweSystemSettings> {
  return createSettingsService(db).getSettings();
}

export async function getSystemSettingsForClient(db?: PrismaClient): Promise<UweSystemSettings> {
  return createSettingsService(db).getSettingsForClient();
}

export interface SystemSettingsSnapshot {
  settings: UweSystemSettings;
  updatedAt: string | null;
}

export async function getSystemSettingsSnapshot(
  db?: PrismaClient,
): Promise<SystemSettingsSnapshot> {
  const client = db ?? prisma;
  const row = await client.systemSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (!row) {
    return {
      settings: normalizeSettings(DEFAULT_SYSTEM_SETTINGS),
      updatedAt: null,
    };
  }
  return {
    settings: mergeSettings(DEFAULT_SYSTEM_SETTINGS, row.settings),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function buildAppSettingsFromThemePreferences(
  current: AppSettings,
  scope: ThemePreferencesScope,
  preferences: ThemePreferencesRecord,
): Partial<AppSettings> {
  return {
    themePreferences: {
      ...normalizeAppThemePreferences(current.themePreferences),
      [scope]: preferences,
    },
    backgroundPattern: mapClientBackgroundToServer(preferences.background),
    frostedGlass: preferences.frostedGlass,
  };
}
