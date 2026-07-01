import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "./client";
import {
  resolveAllDataPaths,
  resolveDatabaseFilePath,
  type ResolvedDataPaths,
} from "@uwe/assets";
import { getMigrationStatus, type MigrationStatus } from "./migration-status";
import {
  PAGE_TEMPLATE_SEED_KEY,
  PAGE_TEMPLATE_SEED_VERSION,
} from "./page-template-service";
import { isSeedApplied } from "./seed-tracker";
import {
  isPublicPortalExposureEnabled,
  isRunDbSeedUnsafe,
  isWeakAuthSecret,
} from "./production-safety";
import {
  SettingsService,
  resolveEffectiveBackupsPath,
  resolveEffectiveExportsPath,
  resolveEffectiveUploadsPath,
} from "./settings-service";
import {
  getTurnstileConfig,
  getUweRuntimeConfig,
  isPublicExposureConfigured,
  isSplitHostnameDeployment,
  resolveUweAppUrls,
  type UweDeploymentModel,
} from "@uwe/auth";
import { UWE_VERSION } from "./version";

/**
 * Extended system status for healthchecks and the dashboard.
 *
 * Deliberately leaks no sensitive data: only booleans, counts and
 * non-secret configuration facts (e.g. *whether* a Studio API token is
 * configured, never its value).
 */

export interface StorageStatus {
  ok: boolean;
  uploadsWritable: boolean;
  backupsWritable: boolean;
  exportsWritable: boolean;
  databaseFileExists: boolean | null;
  paths: ResolvedDataPaths;
  message: string;
}

export interface AppRuntimeStatus {
  ok: boolean;
  nodeEnv: string;
  production: boolean;
}

export interface SeedStatusSummary {
  pageTemplatesSeeded: boolean;
  expectedVersion: number;
}

export interface CloudflareStatusSummary {
  tunnelConfigured: boolean;
  accessEnabled: boolean;
  allowlistConfigured: boolean;
  portalUrlConfigured: boolean;
  studioUrlConfigured: boolean;
  portalUrlMatchesPublicBase: boolean;
  studioOnSeparateHost: boolean;
  deploymentModel: UweDeploymentModel;
  /** Cloudflare Turnstile "Verify you are human" check on the login forms. */
  humanVerificationEnabled: boolean;
  /** Whether a Turnstile secret key is configured for server-side verification. */
  humanVerificationConfigured: boolean;
}

export interface ProxyStatus {
  publicAppUrl: string | null;
  trustProxy: boolean;
  cloudflareTunnel: boolean;
  cloudflareAccessEnabled: boolean;
  cloudflareAccessAllowlistConfigured: boolean;
  studioPath: string;
  portalPath: string;
  studioUrl: string | null;
  portalUrl: string | null;
  deploymentModel: UweDeploymentModel;
  cloudflare: CloudflareStatusSummary;
  authRequired: boolean;
  sessionCookieSecure: boolean;
  playerPreviewPublic: boolean;
  playerPreviewRequireToken: boolean;
  playerPreviewAllowDmOnly: boolean;
  publicExposureConfigured: boolean;
}

export interface TrustStatus {
  /** Studio session login mode when AUTH_REQUIRED is enforced. */
  studioLogin: "session-login" | "none-by-design";
  studioApiTokenConfigured: boolean;
  authSecretConfigured: boolean;
  authSecretLooksWeak: boolean;
  runDbSeedDisabled: boolean;
  publicPortalSharingEnabled: boolean;
  exposureHint: string;
}

export interface MailStatus {
  enabled: boolean;
  configured: boolean;
  useMock: boolean;
  message: string;
}

export interface SystemStatus {
  ok: boolean;
  version: string;
  commit: string | null;
  app: AppRuntimeStatus;
  database: { ok: boolean; message: string };
  migrations: MigrationStatus;
  storage: StorageStatus;
  seeds: SeedStatusSummary;
  trust: TrustStatus;
  proxy: ProxyStatus;
  mail: MailStatus;
  rateLimiter: { mode: string };
}

function checkDirWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.uwe-write-probe-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

export async function getStorageStatus(db: PrismaClient): Promise<StorageStatus> {
  try {
    const settings = await new SettingsService(db).getSettings();
    const uploadsDir = resolveEffectiveUploadsPath(settings);
    const backupsDir = resolveEffectiveBackupsPath(settings);
    const exportsDir = resolveEffectiveExportsPath(settings);
    const paths = resolveAllDataPaths();

    const uploadsWritable = checkDirWritable(uploadsDir);
    const backupsWritable = checkDirWritable(backupsDir);
    const exportsWritable = checkDirWritable(exportsDir);

    const databaseFile = resolveDatabaseFilePath();
    const databaseFileExists = databaseFile ? fs.existsSync(databaseFile) : null;

    const ok = uploadsWritable && backupsWritable && exportsWritable;

    const issues = [
      !uploadsWritable && "Uploads",
      !backupsWritable && "Backups",
      !exportsWritable && "Exports",
    ].filter(Boolean);

    return {
      ok,
      uploadsWritable,
      backupsWritable,
      exportsWritable,
      databaseFileExists,
      paths: {
        ...paths,
        uploadsDir,
        backupsDir,
        exportsDir,
      },
      message:
        issues.length === 0
          ? "Uploads-, Backup- und Export-Verzeichnis beschreibbar."
          : `Nicht beschreibbar: ${issues.join(", ")}.`,
    };
  } catch (error) {
    const paths = resolveAllDataPaths();
    return {
      ok: false,
      uploadsWritable: false,
      backupsWritable: false,
      exportsWritable: false,
      databaseFileExists: null,
      paths,
      message: error instanceof Error ? error.message : "Storage-Check fehlgeschlagen.",
    };
  }
}

export function getAppRuntimeStatus(): AppRuntimeStatus {
  const nodeEnv = process.env.NODE_ENV?.trim() || "development";
  const production = nodeEnv === "production";

  return {
    ok: true,
    nodeEnv,
    production,
  };
}

export function getProxyStatus(env: NodeJS.ProcessEnv = process.env): ProxyStatus {
  const runtime = getUweRuntimeConfig(env);
  const urls = resolveUweAppUrls(env);
  const allowlistRaw =
    env.STUDIO_ACCESS_ALLOWED_EMAILS?.trim() || env.STUDIO_ACCESS_EMAIL?.trim() || "";

  const publicBase = runtime.publicAppUrl?.replace(/\/$/, "") ?? null;
  const portalBase = urls.portalUrl?.replace(/\/$/, "") ?? null;
  const splitHostname = isSplitHostnameDeployment(env);
  const turnstile = getTurnstileConfig(env);

  return {
    publicAppUrl: runtime.publicAppUrl,
    trustProxy: runtime.trustProxy,
    cloudflareTunnel: runtime.cloudflareTunnel,
    cloudflareAccessEnabled: runtime.cloudflareAccessEnabled,
    cloudflareAccessAllowlistConfigured: Boolean(allowlistRaw),
    studioPath: urls.studioPath,
    portalPath: urls.portalPath,
    studioUrl: urls.studioUrl,
    portalUrl: urls.portalUrl,
    deploymentModel: urls.deploymentModel,
    cloudflare: {
      tunnelConfigured: runtime.cloudflareTunnel && runtime.trustProxy,
      accessEnabled: runtime.cloudflareAccessEnabled,
      allowlistConfigured: Boolean(allowlistRaw),
      portalUrlConfigured: Boolean(urls.portalUrl),
      studioUrlConfigured: Boolean(urls.studioUrl),
      portalUrlMatchesPublicBase: Boolean(
        publicBase && portalBase && publicBase.toLowerCase() === portalBase.toLowerCase(),
      ),
      studioOnSeparateHost: splitHostname,
      deploymentModel: urls.deploymentModel,
      humanVerificationEnabled: turnstile.enabled,
      humanVerificationConfigured: turnstile.secretConfigured,
    },
    authRequired: runtime.authRequired,
    sessionCookieSecure: runtime.sessionCookieSecure,
    playerPreviewPublic: runtime.playerPreviewPublic,
    playerPreviewRequireToken: runtime.playerPreviewRequireToken,
    playerPreviewAllowDmOnly: runtime.playerPreviewAllowDmOnly,
    publicExposureConfigured: isPublicExposureConfigured(env),
  };
}

export async function getSystemStatus(
  db: PrismaClient,
  options: { rateLimiterMode?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<SystemStatus> {
  const env = options.env ?? process.env;
  let databaseStatus: { ok: boolean; message: string };
  try {
    await db.$queryRawUnsafe("SELECT 1");
    databaseStatus = { ok: true, message: "Datenbank erreichbar." };
  } catch (error) {
    databaseStatus = {
      ok: false,
      message: error instanceof Error ? error.message : "Datenbank nicht erreichbar.",
    };
  }

  const migrations = databaseStatus.ok
    ? await getMigrationStatus(db)
    : {
        ok: false,
        appliedCount: 0,
        appliedMigrations: [],
        pendingMigrations: [],
        failedMigrations: [],
        failedDetails: [],
        message: "Übersprungen — Datenbank nicht erreichbar.",
      };

  const storage = databaseStatus.ok
    ? await getStorageStatus(db)
    : {
        ok: false,
        uploadsWritable: false,
        backupsWritable: false,
        exportsWritable: false,
        databaseFileExists: null,
        paths: resolveAllDataPaths(),
        message: "Übersprungen — Datenbank nicht erreichbar.",
      };

  let pageTemplatesSeeded = false;
  if (databaseStatus.ok) {
    try {
      pageTemplatesSeeded = await isSeedApplied(
        db,
        PAGE_TEMPLATE_SEED_KEY,
        PAGE_TEMPLATE_SEED_VERSION,
      );
    } catch {
      pageTemplatesSeeded = false;
    }
  }

  let publicPortalSharingEnabled = false;
  let mailStatus: MailStatus = {
    enabled: false,
    configured: false,
    useMock: false,
    message: "Übersprungen — Datenbank nicht erreichbar.",
  };
  if (databaseStatus.ok) {
    try {
      const settings = await new SettingsService(db).getSettings();
      publicPortalSharingEnabled = isPublicPortalExposureEnabled(settings);
      mailStatus = {
        enabled: settings.mail.enabled,
        configured: settings.mail.smtp.configured,
        useMock: settings.mail.smtp.useMock,
        message: settings.mail.smtp.message,
      };
    } catch {
      publicPortalSharingEnabled = false;
    }
  }

  const authSecret = env.AUTH_SECRET ?? env.SESSION_SECRET;

  return {
    ok: databaseStatus.ok && migrations.ok && storage.ok,
    version: UWE_VERSION,
    commit: env.UWE_COMMIT ?? env.GIT_COMMIT ?? null,
    app: getAppRuntimeStatus(),
    database: databaseStatus,
    migrations,
    storage,
    seeds: {
      pageTemplatesSeeded,
      expectedVersion: PAGE_TEMPLATE_SEED_VERSION,
    },
    trust: {
      studioLogin: getUweRuntimeConfig(env).authRequired ? "session-login" : "none-by-design",
      studioApiTokenConfigured: Boolean(env.STUDIO_API_TOKEN?.trim()),
      authSecretConfigured: Boolean(authSecret?.trim()),
      authSecretLooksWeak: isWeakAuthSecret(authSecret),
      runDbSeedDisabled: !isRunDbSeedUnsafe(),
      publicPortalSharingEnabled,
      exposureHint:
        "Studio erzwingt Session-Login wenn AUTH_REQUIRED=true — zusätzlich Reverse-Proxy-Auth, VPN oder Cloudflare Access als äußere Schutzschicht nutzen.",
    },
    proxy: getProxyStatus(env),
    mail: mailStatus,
    rateLimiter: {
      mode: options.rateLimiterMode ?? "in-memory (prozesslokal)",
    },
  };
}
