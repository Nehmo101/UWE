import fs from "node:fs";
import path from "node:path";
import { resolveBackupsDirFromEnv } from "@uwe/assets";
import { isWeakSecret as isWeakAuthSecret } from "@uwe/env";
import type { PrismaClient } from "./client";
import type { InspectorSeverity } from "./world-inspector";
import { SettingsService, type UweSystemSettings } from "./settings-service";
import {
  getUweRuntimeConfig,
  isPublicExposureConfigured,
} from "@uwe/auth";
import { assessStudioSecurity } from "./studio-security";
import { getSystemStatus } from "./system-status";

export interface ProductionSafetyWarning {
  id: string;
  severity: InspectorSeverity;
  title: string;
  description: string;
  href?: string;
}

export { isWeakAuthSecret };

export interface BackupFreshnessStatus {
  backupCount: number;
  latestBackupAt: Date | null;
  latestBackupFilename: string | null;
  backupsDir: string;
  readable: boolean;
}

const BACKUP_STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * Demo seeding should be disabled in production/self-hosted deployments.
 */
export function isRunDbSeedUnsafe(): boolean {
  return (process.env.RUN_DB_SEED ?? "auto") !== "false";
}

export function isStudioApiTokenMissing(): boolean {
  return !process.env.STUDIO_API_TOKEN?.trim();
}

export function isPublicPortalExposureEnabled(settings: UweSystemSettings): boolean {
  return settings.portal.publicSharingEnabled || settings.portal.guestAccessEnabled;
}

export function getBackupFreshnessStatus(
  backupsDir: string = resolveBackupsDirFromEnv(),
): BackupFreshnessStatus {
  if (!fs.existsSync(backupsDir)) {
    return {
      backupCount: 0,
      latestBackupAt: null,
      latestBackupFilename: null,
      backupsDir,
      readable: false,
    };
  }

  try {
    const backups = fs
      .readdirSync(backupsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(zip|json|enc)$/i.test(entry.name))
      .map((entry) => {
        const filePath = path.join(backupsDir, entry.name);
        const stat = fs.statSync(filePath);
        return {
          filename: entry.name,
          createdAt: stat.mtime,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const latest = backups[0] ?? null;
    return {
      backupCount: backups.length,
      latestBackupAt: latest?.createdAt ?? null,
      latestBackupFilename: latest?.filename ?? null,
      backupsDir,
      readable: true,
    };
  } catch {
    return {
      backupCount: 0,
      latestBackupAt: null,
      latestBackupFilename: null,
      backupsDir,
      readable: false,
    };
  }
}

/**
 * Production/self-hosting warnings for dashboard and health surfaces.
 * Never includes secret values — only configuration facts.
 */
export async function getProductionSafetyWarnings(
  db: PrismaClient,
): Promise<ProductionSafetyWarning[]> {
  const warnings: ProductionSafetyWarning[] = [];
  const settings = await new SettingsService(db).getSettings();
  const backupFreshness = getBackupFreshnessStatus();

  const sessionSecret =
    process.env.SESSION_SECRET?.trim() || process.env.AUTH_SECRET?.trim();

  if (isWeakAuthSecret(sessionSecret)) {
    warnings.push({
      id: "production:auth-secret",
      severity: "critical",
      title: "SESSION_SECRET fehlt oder ist unsicher",
      description:
        "Setze in .env ein starkes, zufälliges SESSION_SECRET (Alias: AUTH_SECRET, z. B. openssl rand -base64 32). Platzhalter und kurze Werte sind nicht zulässig.",
      href: "/settings",
    });
  }

  if (isRunDbSeedUnsafe()) {
    warnings.push({
      id: "production:run-db-seed",
      severity: "critical",
      title: "RUN_DB_SEED ist nicht false",
      description:
        "In Produktion RUN_DB_SEED=false setzen, damit keine Demo-Welten automatisch angelegt werden.",
      href: "/settings",
    });
  }

  if (!backupFreshness.readable) {
    warnings.push({
      id: "production:backup-path",
      severity: "warning",
      title: "Backup-Verzeichnis nicht lesbar",
      description:
        "UWE konnte das Backup-Verzeichnis nicht lesen. Prüfe UWE_BACKUP_DIR/BACKUPS_DIR und Dateirechte, bevor du Updates oder Restores ausführst.",
      href: "/backup",
    });
  } else if (backupFreshness.backupCount === 0) {
    warnings.push({
      id: "production:backup-missing",
      severity: "warning",
      title: "Kein Backup gefunden",
      description:
        "Im Backup-Verzeichnis wurde kein ZIP/JSON/ENC-Backup gefunden. Erstelle ein Vollbackup, bevor du Updates, Migrationen oder Restores ausführst.",
      href: "/backup",
    });
  } else if (
    backupFreshness.latestBackupAt &&
    Date.now() - backupFreshness.latestBackupAt.getTime() > BACKUP_STALE_AFTER_MS
  ) {
    warnings.push({
      id: "production:backup-stale",
      severity: "warning",
      title: "Letztes Backup ist älter als 7 Tage",
      description: `Letztes Backup: ${backupFreshness.latestBackupFilename ?? "unbekannt"}. Erstelle vor Updates oder Restores ein aktuelles Vollbackup.`,
      href: "/backup",
    });
  }

  if (isStudioApiTokenMissing()) {
    warnings.push({
      id: "production:studio-api-token",
      severity: isPublicExposureConfigured() ? "critical" : "warning",
      title: "STUDIO_API_TOKEN nicht gesetzt",
      description: isPublicExposureConfigured()
        ? "Öffentliche Erreichbarkeit (PUBLIC_APP_URL/CLOUDFLARE_TUNNEL) erkannt — setze STUDIO_API_TOKEN und erzwinge den UWE-Login (AUTH_REQUIRED=true)."
        : "Empfohlen bei exponiertem Studio: Bearer-Token für sensible APIs (Backup, Restore, Settings, AI) setzen.",
      href: "/settings",
    });
  }

  if (isPublicExposureConfigured()) {
    warnings.push({
      id: "production:cloudflare-tunnel-scope",
      severity: "warning",
      title: "Cloudflare/Proxy nur auf UWE zeigen",
      description:
        "Der Tunnel oder Reverse Proxy darf nur auf UWE (Studio/Portal) zeigen — niemals auf Ollama, LM Studio oder den RTX-Inference-Endpoint.",
    });
  }

  const runtime = getUweRuntimeConfig();
  if (runtime.isProduction && runtime.playerPreviewAllowDmOnly) {
    warnings.push({
      id: "production:player-preview-dm-only",
      severity: "critical",
      title: "PLAYER_PREVIEW_ALLOW_DM_ONLY ist aktiv",
      description:
        "DM-only Inhalte dürfen in Player Preview nicht freigegeben werden. Setze PLAYER_PREVIEW_ALLOW_DM_ONLY=false in Production.",
    });
  }

  if (runtime.isProduction && !runtime.authRequired) {
    warnings.push({
      id: "production:auth-not-required",
      severity: "warning",
      title: "AUTH_REQUIRED ist deaktiviert",
      description:
        "In Production sollte AUTH_REQUIRED=true gesetzt sein, damit das Portal nicht anonym erreichbar ist.",
    });
  }

  const system = await getSystemStatus(db);
  const studioSecurity = assessStudioSecurity(system);
  const studioWarningSeverity: InspectorSeverity =
    studioSecurity.severity === "ok"
      ? studioSecurity.level === "local_only"
        ? "info"
        : "info"
      : studioSecurity.severity === "warning"
        ? "warning"
        : "critical";

  if (studioSecurity.level !== "protected" || studioSecurity.severity !== "ok") {
    warnings.push({
      id: "production:studio-exposure",
      severity: studioWarningSeverity,
      title:
        studioSecurity.level === "local_only"
          ? "Studio nur lokal — bei Exposition Schutz einplanen"
          : studioSecurity.level === "protected" && studioSecurity.severity === "warning"
            ? "Studio teilweise abgesichert"
            : studioSecurity.level === "misconfigured"
              ? "Studio-Konfiguration widersprüchlich"
              : "Studio möglicherweise ungeschützt",
      description: studioSecurity.message,
      href: "/admin/status",
    });
  } else if (studioSecurity.level === "protected" && studioSecurity.severity === "ok") {
    warnings.push({
      id: "production:studio-exposure",
      severity: "info",
      title: "Studio geschützt",
      description: studioSecurity.message,
      href: "/admin/status",
    });
  }

  if (isPublicPortalExposureEnabled(settings)) {
    const enabled: string[] = [];
    if (settings.portal.guestAccessEnabled) enabled.push("Gastzugang");
    if (settings.portal.publicSharingEnabled) enabled.push("öffentliche Share-Links");
    warnings.push({
      id: "production:portal-sharing",
      severity: "warning",
      title: "Öffentliche Portal-/Share-Funktionen aktiv",
      description: `Aktiv: ${enabled.join(", ")}. Prüfe bewusst, welche Inhalte und Links dadurch erreichbar sind.`,
      href: "/settings",
    });
  }

  warnings.push({
    id: "production:rate-limiter",
    severity: "info",
    title: "Rate Limiter ist prozesslokal",
    description:
      "Login- und Share-Passwort-Limits gelten nur pro Instanz. Bei mehreren Studio-/Portal-Containern zusätzlich am Reverse Proxy limitieren.",
  });

  return warnings;
}
