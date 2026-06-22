import path from "node:path";
import type { CanonicalStatus, Prisma, PrismaClient, Visibility } from "./generated/prisma/client";
import {
  resolveBackupsDirFromEnv,
  resolveDataDir,
  resolveDatabaseFilePath,
  resolveExportsDirFromEnv,
  resolveUploadsDirFromEnv,
} from "@uwe/assets";
import { getMailConfigStatus, getMailConfigStatusFromSmtpConfig, mergeSmtpConfig } from "@uwe/mail";
import { prisma } from "./client";
import {
  decryptSecret,
  encryptSecret,
  resolveTokenEncryptionSecret,
} from "./token-crypto";
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

export interface AuthSettings {
  /** Auto-logout after this many minutes of inactivity. 0 = disabled. */
  sessionInactivityTimeoutMinutes: number;
}

export interface MailSmtpStatus {
  host: string | null;
  port: number | null;
  secure: boolean;
  userConfigured: boolean;
  passwordConfigured: boolean;
  username: string | null;
  fromAddress: string | null;
  configured: boolean;
  useMock: boolean;
  message: string;
  /** Whether SMTP is loaded from Admin Portal settings or .env fallback. */
  source: "portal" | "env";
}

/** Encrypted SMTP credentials stored in system settings (never sent to clients). */
export interface MailSmtpStoredCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  passwordEnc: string;
  from: string;
  useMock: boolean;
}

export interface MailSettings {
  enabled: boolean;
  fromDisplayName: string;
  logBody: boolean;
  smtp: MailSmtpStatus;
  smtpCredentials?: MailSmtpStoredCredentials | null;
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
  auth: AuthSettings;
}

export type UweSystemSettingsUpdate = {
  app?: Partial<AppSettings>;
  worlds?: Partial<WorldSettings>;
  campaigns?: Partial<CampaignSettings>;
  portal?: Partial<PortalSettings>;
  ai?: Partial<Pick<AiSettings, "localOnlyMode" | "enabled">>;
  mail?: Partial<Pick<MailSettings, "enabled" | "fromDisplayName" | "logBody" | "smtpCredentials">>;
  storage?: Partial<StorageSettings>;
  backup?: Partial<BackupSettings>;
  privacy?: Partial<PrivacySettings>;
  auth?: Partial<AuthSettings>;
};

const SETTINGS_ID = "default";

interface MailSettingsInput {
  enabled?: boolean;
  fromDisplayName?: string;
  logBody?: boolean;
  smtpCredentials?: MailSmtpStoredCredentials | null;
}

function readMailSettingsInput(stored: unknown): MailSettingsInput | undefined {
  if (!isRecord(stored)) {
    return undefined;
  }

  const mail = stored as Record<string, unknown>;
  const smtpCredentials = mail.smtpCredentials;
  return {
    enabled: typeof mail.enabled === "boolean" ? mail.enabled : undefined,
    fromDisplayName: typeof mail.fromDisplayName === "string" ? mail.fromDisplayName : undefined,
    logBody: typeof mail.logBody === "boolean" ? mail.logBody : undefined,
    smtpCredentials:
      smtpCredentials === null
        ? null
        : isRecord(smtpCredentials)
          ? (smtpCredentials as unknown as MailSmtpStoredCredentials)
          : undefined,
  };
}

function buildMailSettings(stored?: MailSettingsInput): MailSettings {
  const enabled = stored?.enabled;
  const logBody = stored?.logBody;
  const portalConfig = stored?.smtpCredentials
    ? {
        enabled: enabled ?? true,
        host: stored.smtpCredentials.host,
        port: stored.smtpCredentials.port,
        secure: stored.smtpCredentials.secure,
        user: stored.smtpCredentials.user,
        password: decryptSecret(stored.smtpCredentials.passwordEnc, resolveTokenEncryptionSecret()),
        from: stored.smtpCredentials.from,
        logBody: logBody ?? false,
        useMock: stored.smtpCredentials.useMock,
      }
    : null;
  const effectiveConfig = mergeSmtpConfig(process.env, portalConfig, { enabled, logBody });
  const smtpFromPortal = Boolean(stored?.smtpCredentials);
  const baseStatus = getMailConfigStatusFromSmtpConfig(effectiveConfig);
  const envStatus = getMailConfigStatus(process.env, { enabled, logBody });

  const status: MailSmtpStatus = smtpFromPortal
    ? {
        ...baseStatus,
        username: effectiveConfig.user || null,
        source: "portal",
        message: effectiveConfig.useMock
          ? "Mock-Modus aktiv — keine echte SMTP-Verbindung."
          : effectiveConfig.user && effectiveConfig.password
            ? "SMTP über Admin Portal konfiguriert."
            : "SMTP-Host gesetzt — Anmeldedaten unvollständig.",
      }
    : {
        ...envStatus,
        username: process.env.SMTP_USER?.trim() || null,
        source: "env",
      };

  return {
    enabled: enabled ?? envStatus.enabled,
    fromDisplayName: stored?.fromDisplayName?.trim() ?? "",
    logBody: logBody ?? envStatus.logBody,
    smtp: status,
    smtpCredentials: stored?.smtpCredentials ?? null,
  };
}

export function resolveEffectiveSmtpConfig(
  settings: UweSystemSettings,
  env: NodeJS.ProcessEnv = process.env,
): import("@uwe/mail").SmtpConfig {
  const creds = settings.mail.smtpCredentials;
  const portalConfig = creds?.host
    ? {
        enabled: settings.mail.enabled,
        host: creds.host,
        port: creds.port,
        secure: creds.secure,
        user: creds.user,
        password: decryptSecret(creds.passwordEnc, resolveTokenEncryptionSecret()),
        from: creds.from,
        logBody: settings.mail.logBody,
        useMock: creds.useMock,
      }
    : null;

  return mergeSmtpConfig(env, portalConfig, {
    enabled: settings.mail.enabled,
    logBody: settings.mail.logBody,
  });
}

export function buildMailSmtpCredentialsUpdate(input: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  from: string;
  useMock: boolean;
  existing?: MailSmtpStoredCredentials | null;
}): MailSmtpStoredCredentials | null {
  const host = input.host.trim();
  if (!host && !input.useMock) {
    return null;
  }

  const password = input.password?.trim();
  const passwordEnc =
    password && password.length > 0
      ? encryptSecret(password, resolveTokenEncryptionSecret())
      : input.existing?.passwordEnc;

  if (!passwordEnc && !input.useMock) {
    throw new Error("SMTP_PASSWORD_REQUIRED");
  }

  return {
    host,
    port: input.port,
    secure: input.secure,
    user: input.user.trim(),
    passwordEnc: passwordEnc ?? "",
    from: input.from.trim(),
    useMock: input.useMock,
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
  auth: {
    sessionInactivityTimeoutMinutes: 30,
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
    mail: buildMailSettings(readMailSettingsInput(stored.mail)),
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
    auth: {
      ...base.auth,
      ...(isRecord(stored.auth) ? (stored.auth as unknown as AuthSettings) : {}),
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
      smtpCredentials: settings.mail.smtpCredentials,
    }),
    privacy: {
      ...settings.privacy,
      maskSecretsInUi: true,
    },
    auth: {
      ...DEFAULT_SYSTEM_SETTINGS.auth,
      ...settings.auth,
      sessionInactivityTimeoutMinutes: normalizeSessionInactivityTimeoutMinutes(
        settings.auth?.sessionInactivityTimeoutMinutes,
      ),
    },
  };
}

function normalizeSessionInactivityTimeoutMinutes(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SYSTEM_SETTINGS.auth.sessionInactivityTimeoutMinutes;
  }
  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 24 * 60) {
    return 24 * 60;
  }
  return rounded;
}

export function resolveSessionInactivityTimeoutMs(
  settings: UweSystemSettings,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const fromSettings = normalizeSessionInactivityTimeoutMinutes(
    settings.auth?.sessionInactivityTimeoutMinutes,
  );
  if (fromSettings > 0) {
    return fromSettings * 60 * 1000;
  }

  const envRaw = env.SESSION_INACTIVITY_TIMEOUT_MINUTES?.trim();
  if (!envRaw) {
    return 0;
  }

  const fromEnv = Number.parseInt(envRaw, 10);
  if (!Number.isFinite(fromEnv) || fromEnv <= 0) {
    return 0;
  }

  return Math.min(fromEnv, 24 * 60) * 60 * 1000;
}

export function sanitizeSettingsForClient(settings: UweSystemSettings): UweSystemSettings {
  const normalized = normalizeSettings(settings);
  return {
    ...normalized,
    mail: {
      ...normalized.mail,
      smtpCredentials: undefined,
    },
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
        smtpCredentials:
          update.mail?.smtpCredentials !== undefined
            ? update.mail.smtpCredentials
            : current.mail.smtpCredentials,
      }),
      storage: { ...current.storage, ...update.storage },
      backup: { ...current.backup, ...update.backup },
      privacy: { ...current.privacy, ...update.privacy },
      auth: { ...current.auth, ...update.auth },
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
