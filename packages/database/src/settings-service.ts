import path from "node:path";
import type { CanonicalStatus, Prisma, PrismaClient, Visibility } from "./generated/prisma/client";
import { createPrismaClient, prisma } from "./client";

export type ThemeAppearance = "dark" | "light" | "system";

export interface AppSettings {
  theme: ThemeAppearance;
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
}

export interface BackupSettings {
  backupsPath: string;
  autoBackupEnabled: boolean;
}

export interface PrivacySettings {
  maskSecretsInUi: boolean;
  restrictPublicExport: boolean;
}

export interface UweSystemSettings {
  app: AppSettings;
  worlds: WorldSettings;
  campaigns: CampaignSettings;
  portal: PortalSettings;
  ai: AiSettings;
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
  storage?: Partial<StorageSettings>;
  backup?: Partial<BackupSettings>;
  privacy?: Partial<PrivacySettings>;
};

const SETTINGS_ID = "default";

export const DEFAULT_SYSTEM_SETTINGS: UweSystemSettings = {
  app: {
    theme: "dark",
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
  storage: {
    uploadsPath: "",
  },
  backup: {
    backupsPath: "",
    autoBackupEnabled: false,
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
    ai: {
      ...settings.ai,
      providerKeyPlaceholders: buildProviderKeyPlaceholders(),
    },
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

  if (process.env.UPLOADS_DIR) {
    const uploadsDir = process.env.UPLOADS_DIR;
    return path.isAbsolute(uploadsDir)
      ? uploadsDir
      : path.resolve(baseDir ?? process.cwd(), uploadsDir);
  }

  return path.join(baseDir ?? process.cwd(), "uploads");
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

  if (process.env.BACKUPS_DIR) {
    const backupsDir = process.env.BACKUPS_DIR;
    return path.isAbsolute(backupsDir)
      ? backupsDir
      : path.resolve(baseDir ?? process.cwd(), backupsDir);
  }

  return path.join(baseDir ?? process.cwd(), "data", "backups");
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
