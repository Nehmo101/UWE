import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "./client";
import { getMigrationStatus, type MigrationStatus } from "./migration-status";
import {
  PAGE_TEMPLATE_SEED_KEY,
  PAGE_TEMPLATE_SEED_VERSION,
} from "./page-template-service";
import { isSeedApplied } from "./seed-tracker";
import {
  isPublicPortalExposureEnabled,
  isRunDbSeedUnsafe,
  isStudioApiTokenMissing,
  isWeakAuthSecret,
} from "./production-safety";
import {
  SettingsService,
  resolveEffectiveBackupsPath,
  resolveEffectiveUploadsPath,
} from "./settings-service";
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
  message: string;
}

export interface SeedStatusSummary {
  pageTemplatesSeeded: boolean;
  expectedVersion: number;
}

export interface TrustStatus {
  /** Studio has no login by design — exposure is controlled at network level. */
  studioLogin: "none-by-design";
  studioApiTokenConfigured: boolean;
  authSecretConfigured: boolean;
  authSecretLooksWeak: boolean;
  runDbSeedDisabled: boolean;
  publicPortalSharingEnabled: boolean;
  exposureHint: string;
}

export interface SystemStatus {
  ok: boolean;
  version: string;
  commit: string | null;
  database: { ok: boolean; message: string };
  migrations: MigrationStatus;
  storage: StorageStatus;
  seeds: SeedStatusSummary;
  trust: TrustStatus;
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

    const uploadsWritable = checkDirWritable(uploadsDir);
    const backupsWritable = checkDirWritable(backupsDir);
    const ok = uploadsWritable && backupsWritable;

    return {
      ok,
      uploadsWritable,
      backupsWritable,
      message: ok
        ? "Uploads- und Backup-Verzeichnis beschreibbar."
        : `Nicht beschreibbar: ${[
            !uploadsWritable && "Uploads",
            !backupsWritable && "Backups",
          ]
            .filter(Boolean)
            .join(", ")}.`,
    };
  } catch (error) {
    return {
      ok: false,
      uploadsWritable: false,
      backupsWritable: false,
      message: error instanceof Error ? error.message : "Storage-Check fehlgeschlagen.",
    };
  }
}

export async function getSystemStatus(
  db: PrismaClient,
  options: { rateLimiterMode?: string } = {},
): Promise<SystemStatus> {
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
        pendingMigrations: [],
        failedMigrations: [],
        message: "Übersprungen — Datenbank nicht erreichbar.",
      };

  const storage = databaseStatus.ok
    ? await getStorageStatus(db)
    : {
        ok: false,
        uploadsWritable: false,
        backupsWritable: false,
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
  if (databaseStatus.ok) {
    try {
      const settings = await new SettingsService(db).getSettings();
      publicPortalSharingEnabled = isPublicPortalExposureEnabled(settings);
    } catch {
      publicPortalSharingEnabled = false;
    }
  }

  const authSecret = process.env.AUTH_SECRET;
  const authSecretConfigured = Boolean(authSecret?.trim());

  return {
    ok: databaseStatus.ok && migrations.ok && storage.ok,
    version: UWE_VERSION,
    commit: process.env.UWE_COMMIT ?? process.env.GIT_COMMIT ?? null,
    database: databaseStatus,
    migrations,
    storage,
    seeds: {
      pageTemplatesSeeded,
      expectedVersion: PAGE_TEMPLATE_SEED_VERSION,
    },
    trust: {
      studioLogin: "none-by-design",
      studioApiTokenConfigured: !isStudioApiTokenMissing(),
      authSecretConfigured,
      authSecretLooksWeak: isWeakAuthSecret(authSecret),
      runDbSeedDisabled: !isRunDbSeedUnsafe(),
      publicPortalSharingEnabled,
      exposureHint:
        "Studio hat bewusst kein Login — niemals direkt öffentlich ohne Reverse-Proxy-Auth, VPN oder Cloudflare Access betreiben.",
    },
    rateLimiter: {
      mode: options.rateLimiterMode ?? "in-memory (prozesslokal)",
    },
  };
}
