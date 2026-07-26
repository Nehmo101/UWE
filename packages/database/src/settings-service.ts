import type { CanonicalStatus, Prisma, PrismaClient, Visibility } from "./generated/prisma/client";
import { getMailConfigStatus, getMailConfigStatusFromSmtpConfig, mergeSmtpConfig } from "@uwe/mail-core";
import { resolveImageStudioConfigStatus } from "./integrations-service";
import { prisma } from "./client";
import {
  decryptSecret,
  resolveTokenEncryptionSecret,
} from "./token-crypto";
import {
  DEFAULT_DEPLOYMENT_SETTINGS,
  applyDeploymentRuntimeOverrides,
  normalizeDeploymentSettings,
  sanitizeDeploymentSettingsForClient,
  type DeploymentSettings,
} from "./deployment-settings";
import {
  mapClientBackgroundToServer,
  normalizeAppThemePreferences,
  type AppThemePreferences,
  type ThemePreferencesRecord,
  type ThemePreferencesScope,
} from "./theme-preferences";
import {
  normalizeCustomThemes,
  type CustomThemeRecord,
} from "./custom-theme-preferences";
import { normalizeHiddenNavIds } from "./settings-validation-helpers";
import { buildProviderKeyPlaceholders } from "./settings-service-providers";

// Abwärtskompatible öffentliche API: extrahierte Helfer über dieses Modul re-exportieren.
export {
  buildAiProviderKeyUpdate,
  resolveDecryptedProviderKeys,
} from "./settings-service-providers";
export {
  getPersistentPathConfiguration,
  resolveEffectiveBackupsPath,
  resolveEffectiveExportsPath,
  resolveEffectiveUploadsPath,
} from "./settings-service-paths";
export type {
  PersistentPathConfiguration,
  PersistentPathEntry,
  PersistentPathSource,
} from "./settings-service-paths";

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

export const STUDIO_LANDING_PAGE_PATHS = ["/today", "/worlds", "/continue", "/capture"] as const;

export type StudioLandingPagePath = (typeof STUDIO_LANDING_PAGE_PATHS)[number];

const STUDIO_LANDING_PAGE_PATH_SET = new Set<string>(STUDIO_LANDING_PAGE_PATHS);

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
  /** User-authored custom theme palettes, selectable in Studio/Portal pickers. */
  customThemes?: CustomThemeRecord[];
  /** Studio start page for authenticated users visiting `/` (Settings → General). */
  defaultLandingPage?: string | null;
  /** Preferred DnD world slug for /today — never hardcoded; set in settings or env. */
  favoriteWorldSlug?: string | null;
  /** Last actively opened world slug (optional UX hint). */
  lastActiveWorldSlug?: string | null;
  /** UWE_VERSION the owner last acknowledged on the Startklar page. */
  startklarSeenVersion?: string | null;
  /** Sidebar nav item ids hidden via System → Navigation (persisted in DB). */
  hiddenNavIds?: string[];
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
  source: "env" | "db" | "none";
}

/** Encrypted API key stored in system settings (never sent to clients). */
export interface AiProviderStoredKey {
  providerId: string;
  keyEnc: string;
}

export interface AiSettings {
  localOnlyMode: boolean;
  enabled: boolean;
  providerKeyPlaceholders: AiProviderKeyPlaceholder[];
  /** Encrypted provider API keys stored in DB. Never sent to clients. */
  cloudApiKeys?: AiProviderStoredKey[] | null;
  /** Active owner-edited system prompt for general chat (empty = built-in default). */
  generalChatSystemPrompt?: string | null;
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

/** Auto-Morning-Briefing — der systemd-Timer liest die gesyncte schedule.json. */
export interface BriefingSettings {
  autoBriefingEnabled: boolean;
  /** Tägliche Uhrzeit "HH:MM" (lokale Serverzeit), zu der das Briefing läuft. */
  time: string;
}

export interface PrivacySettings {
  maskSecretsInUi: boolean;
  restrictPublicExport: boolean;
}

export interface AuthSettings {
  /** Auto-logout after this many minutes of inactivity. 0 = disabled. */
  sessionInactivityTimeoutMinutes: number;
  /** Whether passkey (WebAuthn) login is offered on the Studio/Portal login pages. */
  passkeysEnabled: boolean;
}

/** Owner emergency / maintenance locks (stored in system_settings JSON). */
export interface MaintenanceSettings {
  maintenanceMode: boolean;
  lockPortal: boolean;
  lockStudio: boolean;
  message: string;
}

export interface UweSystemSettings {
  app: AppSettings;
  worlds: WorldSettings;
  campaigns: CampaignSettings;
  portal: PortalSettings;
  ai: AiSettings;
  mail: MailSettings;
  imageStudio: ImageStudioSettings;
  storage: StorageSettings;
  backup: BackupSettings;
  briefing: BriefingSettings;
  privacy: PrivacySettings;
  auth: AuthSettings;
  maintenance: MaintenanceSettings;
  /** Owner-editable deployment / routing / security overrides (env stays the fallback). */
  deployment: DeploymentSettings;
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

import {
  normalizeMailInboxLimit,
  normalizeMailSyncInterval,
  type MailSyncIntervalMinutes,
} from "./mail-settings";

export interface MailSettings {
  enabled: boolean;
  fromDisplayName: string;
  logBody: boolean;
  inboxLimit: number;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: MailSyncIntervalMinutes;
  smtp: MailSmtpStatus;
  smtpCredentials?: MailSmtpStoredCredentials | null;
}

export interface ImageStudioPortalSettings {
  enabled?: boolean;
  defaultProviderMode?: "auto" | "local_rtx" | "cloud";
  allowCloud?: boolean;
  backgroundRemovalEnabled?: boolean;
}

export interface ImageStudioSettings {
  enabled: boolean;
  defaultProviderMode: "auto" | "local_rtx" | "cloud";
  allowCloud: boolean;
  backgroundRemovalEnabled: boolean;
  rtxAgentConfigured: boolean;
  connectorImageEnabled: boolean;
  localImageBackendReady: boolean;
  cloudApiKeyConfigured: boolean;
  source: "portal" | "env";
  message: string;
}

export type UweSystemSettingsUpdate = {
  app?: Partial<AppSettings>;
  worlds?: Partial<WorldSettings>;
  campaigns?: Partial<CampaignSettings>;
  portal?: Partial<PortalSettings>;
  ai?: Partial<Pick<AiSettings, "localOnlyMode" | "enabled" | "cloudApiKeys" | "generalChatSystemPrompt">>;
  mail?: Partial<
    Pick<
      MailSettings,
      | "enabled"
      | "fromDisplayName"
      | "logBody"
      | "inboxLimit"
      | "autoSyncEnabled"
      | "autoSyncIntervalMinutes"
      | "smtpCredentials"
    >
  >;
  imageStudio?: Partial<ImageStudioPortalSettings>;
  storage?: Partial<StorageSettings>;
  backup?: Partial<BackupSettings>;
  briefing?: Partial<BriefingSettings>;
  privacy?: Partial<PrivacySettings>;
  auth?: Partial<AuthSettings>;
  maintenance?: Partial<MaintenanceSettings>;
  deployment?: Partial<DeploymentSettings>;
};

const SETTINGS_ID = "default";

interface MailSettingsInput {
  enabled?: boolean;
  fromDisplayName?: string;
  logBody?: boolean;
  inboxLimit?: number;
  autoSyncEnabled?: boolean;
  autoSyncIntervalMinutes?: number;
  smtpCredentials?: MailSmtpStoredCredentials | null;
}

function readImageStudioSettingsInput(stored: unknown): ImageStudioPortalSettings | undefined {
  if (!isRecord(stored)) {
    return undefined;
  }
  const imageStudio = stored as Record<string, unknown>;
  const provider = imageStudio.defaultProviderMode;
  return {
    enabled: typeof imageStudio.enabled === "boolean" ? imageStudio.enabled : undefined,
    defaultProviderMode:
      provider === "auto" || provider === "local_rtx" || provider === "cloud"
        ? provider
        : undefined,
    allowCloud: typeof imageStudio.allowCloud === "boolean" ? imageStudio.allowCloud : undefined,
    backgroundRemovalEnabled:
      typeof imageStudio.backgroundRemovalEnabled === "boolean"
        ? imageStudio.backgroundRemovalEnabled
        : undefined,
  };
}

function buildImageStudioSettings(stored?: ImageStudioPortalSettings): ImageStudioSettings {
  const status = resolveImageStudioConfigStatus(process.env, stored);
  return {
    enabled: status.enabled,
    defaultProviderMode: status.defaultProviderMode,
    allowCloud: status.allowCloud,
    backgroundRemovalEnabled: status.backgroundRemovalEnabled,
    rtxAgentConfigured: status.rtxAgentConfigured,
    connectorImageEnabled: status.connectorImageEnabled,
    localImageBackendReady: status.localImageBackendReady,
    cloudApiKeyConfigured: status.cloudApiKeyConfigured,
    source: status.source,
    message: status.message,
  };
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
    inboxLimit: typeof mail.inboxLimit === "number" ? mail.inboxLimit : undefined,
    autoSyncEnabled: typeof mail.autoSyncEnabled === "boolean" ? mail.autoSyncEnabled : undefined,
    autoSyncIntervalMinutes:
      typeof mail.autoSyncIntervalMinutes === "number" ? mail.autoSyncIntervalMinutes : undefined,
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
    inboxLimit: normalizeMailInboxLimit(stored?.inboxLimit),
    autoSyncEnabled: stored?.autoSyncEnabled ?? false,
    autoSyncIntervalMinutes: normalizeMailSyncInterval(stored?.autoSyncIntervalMinutes),
    smtp: status,
    smtpCredentials: stored?.smtpCredentials ?? null,
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

function normalizeDefaultLandingPage(value: unknown): StudioLandingPagePath {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (STUDIO_LANDING_PAGE_PATH_SET.has(trimmed)) {
      return trimmed as StudioLandingPagePath;
    }
  }
  return "/today";
}

function normalizeAppSettings(app: AppSettings): AppSettings {
  return {
    ...app,
    backgroundPattern: normalizeBackgroundPattern(app.backgroundPattern),
    frostedGlass: app.frostedGlass !== false,
    motionEnabled: app.motionEnabled !== false,
    defaultLandingPage: normalizeDefaultLandingPage(app.defaultLandingPage),
    hiddenNavIds: normalizeHiddenNavIds(app.hiddenNavIds),
    themePreferences: normalizeAppThemePreferences(app.themePreferences),
    customThemes: normalizeCustomThemes(app.customThemes),
  };
}

export const DEFAULT_SYSTEM_SETTINGS: UweSystemSettings = {
  app: {
    theme: "light",
    backgroundPattern: "none",
    frostedGlass: false,
    motionEnabled: true,
    defaultLandingPage: "/today",
    favoriteWorldSlug: null,
    lastActiveWorldSlug: null,
    startklarSeenVersion: null,
    hiddenNavIds: [],
    customThemes: [],
    themePreferences: {
      studio: {
        themeId: "uwe-ghibli-tag",
        font: "mono",
        density: "comfortable",
        background: "none",
        frostedGlass: false,
        uiScale: 1,
        bgEffectIntensity: 1,
      },
      portal: {
        themeId: "uwe-ghibli-tag",
        font: "mono",
        density: "comfortable",
        background: "none",
        frostedGlass: false,
        uiScale: 1,
        bgEffectIntensity: 1,
      },
      brain: {
        themeId: "uwe-ghibli-nacht",
        font: "mono",
        density: "comfortable",
        background: "none",
        frostedGlass: false,
        uiScale: 1,
        bgEffectIntensity: 1,
      },
    },
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
    cloudApiKeys: null,
    generalChatSystemPrompt: null,
  },
  mail: buildMailSettings(),
  imageStudio: buildImageStudioSettings(),
  storage: {
    uploadsPath: "",
    exportsPath: "",
  },
  backup: {
    backupsPath: "",
    autoBackupEnabled: false,
    retentionCount: 14,
  },
  briefing: {
    autoBriefingEnabled: false,
    time: "07:00",
  },
  privacy: {
    maskSecretsInUi: true,
    restrictPublicExport: false,
  },
  auth: {
    sessionInactivityTimeoutMinutes: 30,
    passkeysEnabled: false,
  },
  maintenance: {
    maintenanceMode: false,
    lockPortal: false,
    lockStudio: false,
    message: "",
  },
  deployment: DEFAULT_DEPLOYMENT_SETTINGS,
};

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
            cloudApiKeys: Array.isArray((stored.ai as unknown as AiSettings).cloudApiKeys)
              ? ((stored.ai as unknown as AiSettings).cloudApiKeys as AiProviderStoredKey[])
              : null,
            generalChatSystemPrompt:
              typeof (stored.ai as unknown as AiSettings).generalChatSystemPrompt === "string"
                ? (stored.ai as unknown as AiSettings).generalChatSystemPrompt
                : null,
          }
        : {}),
      providerKeyPlaceholders: buildProviderKeyPlaceholders(
        isRecord(stored.ai)
          ? ((stored.ai as unknown as AiSettings).cloudApiKeys ?? null)
          : null,
      ),
    },
    mail: buildMailSettings(readMailSettingsInput(stored.mail)),
    imageStudio: buildImageStudioSettings(readImageStudioSettingsInput(stored.imageStudio)),
    storage: {
      ...base.storage,
      ...(isRecord(stored.storage) ? (stored.storage as unknown as StorageSettings) : {}),
    },
    backup: {
      ...base.backup,
      ...(isRecord(stored.backup) ? (stored.backup as unknown as BackupSettings) : {}),
    },
    briefing: {
      ...base.briefing,
      ...(isRecord(stored.briefing) ? (stored.briefing as unknown as BriefingSettings) : {}),
    },
    privacy: {
      ...base.privacy,
      ...(isRecord(stored.privacy) ? (stored.privacy as unknown as PrivacySettings) : {}),
    },
    auth: {
      ...base.auth,
      ...(isRecord(stored.auth) ? (stored.auth as unknown as AuthSettings) : {}),
    },
    maintenance: {
      ...base.maintenance,
      ...(isRecord(stored.maintenance) ? (stored.maintenance as unknown as MaintenanceSettings) : {}),
    },
    deployment: normalizeDeploymentSettings(
      isRecord(stored.deployment) ? { ...base.deployment, ...stored.deployment } : base.deployment,
    ),
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
      providerKeyPlaceholders: buildProviderKeyPlaceholders(settings.ai.cloudApiKeys),
    },
    mail: buildMailSettings({
      enabled: settings.mail.enabled,
      fromDisplayName: settings.mail.fromDisplayName,
      logBody: settings.mail.logBody,
      inboxLimit: settings.mail.inboxLimit,
      autoSyncEnabled: settings.mail.autoSyncEnabled,
      autoSyncIntervalMinutes: settings.mail.autoSyncIntervalMinutes,
      smtpCredentials: settings.mail.smtpCredentials,
    }),
    imageStudio: buildImageStudioSettings({
      enabled: settings.imageStudio.enabled,
      defaultProviderMode: settings.imageStudio.defaultProviderMode,
      allowCloud: settings.imageStudio.allowCloud,
      backgroundRemovalEnabled: settings.imageStudio.backgroundRemovalEnabled,
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
      passkeysEnabled: settings.auth?.passkeysEnabled === true,
    },
    maintenance: {
      ...DEFAULT_SYSTEM_SETTINGS.maintenance,
      ...settings.maintenance,
      message: typeof settings.maintenance?.message === "string" ? settings.maintenance.message : "",
    },
    deployment: normalizeDeploymentSettings(settings.deployment),
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
      cloudApiKeys: undefined,
    },
    deployment: sanitizeDeploymentSettingsForClient(normalized.deployment),
  };
}

export function isGuestPortalAccessAllowed(
  _settings: UweSystemSettings,
  _worldGuestModeEnabled: boolean,
): boolean {
  return false;
}

export function isMaintenanceModeActive(settings: UweSystemSettings): boolean {
  return settings.maintenance.maintenanceMode;
}

export function isPortalLocked(settings: UweSystemSettings): boolean {
  return settings.maintenance.maintenanceMode || settings.maintenance.lockPortal;
}

export function isStudioLocked(settings: UweSystemSettings): boolean {
  return settings.maintenance.maintenanceMode || settings.maintenance.lockStudio;
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
        cloudApiKeys:
          update.ai?.cloudApiKeys !== undefined
            ? update.ai.cloudApiKeys
            : current.ai.cloudApiKeys,
        providerKeyPlaceholders: buildProviderKeyPlaceholders(
          update.ai?.cloudApiKeys !== undefined
            ? update.ai.cloudApiKeys
            : current.ai.cloudApiKeys,
        ),
      },
      mail: buildMailSettings({
        enabled: update.mail?.enabled ?? current.mail.enabled,
        fromDisplayName: update.mail?.fromDisplayName ?? current.mail.fromDisplayName,
        logBody: update.mail?.logBody ?? current.mail.logBody,
        inboxLimit: update.mail?.inboxLimit ?? current.mail.inboxLimit,
        autoSyncEnabled: update.mail?.autoSyncEnabled ?? current.mail.autoSyncEnabled,
        autoSyncIntervalMinutes:
          update.mail?.autoSyncIntervalMinutes ?? current.mail.autoSyncIntervalMinutes,
        smtpCredentials:
          update.mail?.smtpCredentials !== undefined
            ? update.mail.smtpCredentials
            : current.mail.smtpCredentials,
      }),
      imageStudio: buildImageStudioSettings({
        enabled: update.imageStudio?.enabled ?? current.imageStudio.enabled,
        defaultProviderMode:
          update.imageStudio?.defaultProviderMode ?? current.imageStudio.defaultProviderMode,
        allowCloud: update.imageStudio?.allowCloud ?? current.imageStudio.allowCloud,
        backgroundRemovalEnabled:
          update.imageStudio?.backgroundRemovalEnabled ??
          current.imageStudio.backgroundRemovalEnabled,
      }),
      storage: { ...current.storage, ...update.storage },
      backup: { ...current.backup, ...update.backup },
      briefing: { ...current.briefing, ...update.briefing },
      privacy: { ...current.privacy, ...update.privacy },
      auth: { ...current.auth, ...update.auth },
      maintenance: { ...current.maintenance, ...update.maintenance },
      deployment: { ...current.deployment, ...update.deployment },
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

    // Keep the shared runtime-config overlay fresh in this process on every deployment
    // change (env stays the fallback). Other processes pick it up at their next boot.
    if (update.deployment) {
      applyDeploymentRuntimeOverrides(next.deployment);
    }

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

/**
 * Loads the stored deployment overrides and installs them into the shared `@uwe/auth`
 * runtime-config layer. Call once at Node server boot so DB-configured routing/security
 * values are effective from the first request. Never throws — on any failure the app
 * simply keeps reading `process.env`.
 */
export async function refreshDeploymentRuntimeOverrides(db?: PrismaClient): Promise<void> {
  try {
    const settings = await createSettingsService(db).getSettings();
    applyDeploymentRuntimeOverrides(settings.deployment);
  } catch {
    // Boot-time DB not ready or unreadable — env fallback remains in effect.
  }
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

/** Like {@link getSystemSettingsSnapshot} but never throws — for root layouts on cold start. */
export async function getSystemSettingsSnapshotSafe(
  db?: PrismaClient,
): Promise<SystemSettingsSnapshot> {
  try {
    return await getSystemSettingsSnapshot(db);
  } catch {
    return {
      settings: normalizeSettings(DEFAULT_SYSTEM_SETTINGS),
      updatedAt: null,
    };
  }
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
