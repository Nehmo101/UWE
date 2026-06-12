import type { PrismaClient } from "./client";
import type { InspectorSeverity } from "./world-inspector";
import { SettingsService, type UweSystemSettings } from "./settings-service";

export interface ProductionSafetyWarning {
  id: string;
  severity: InspectorSeverity;
  title: string;
  description: string;
  href?: string;
}

const WEAK_AUTH_SECRET_PATTERNS = [
  /^change[-_]?me$/i,
  /^changeme$/i,
  /^generate-a-random-secret-for-production$/i,
  /^super-secret$/i,
  /^your-secret-here$/i,
  /^dev(elopment)?$/i,
  /^test$/i,
  /^password$/i,
  /^secret$/i,
  /^uwe-dev$/i,
];

/**
 * Returns true when AUTH_SECRET is missing or looks like a placeholder/default.
 */
export function isWeakAuthSecret(secret: string | undefined): boolean {
  const trimmed = secret?.trim();
  if (!trimmed) {
    return true;
  }

  if (trimmed.length < 16) {
    return true;
  }

  return WEAK_AUTH_SECRET_PATTERNS.some((pattern) => pattern.test(trimmed));
}

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

/**
 * Production/self-hosting warnings for dashboard and health surfaces.
 * Never includes secret values — only configuration facts.
 */
export async function getProductionSafetyWarnings(
  db: PrismaClient,
): Promise<ProductionSafetyWarning[]> {
  const warnings: ProductionSafetyWarning[] = [];
  const settings = await new SettingsService(db).getSettings();

  if (isWeakAuthSecret(process.env.AUTH_SECRET)) {
    warnings.push({
      id: "production:auth-secret",
      severity: "critical",
      title: "AUTH_SECRET fehlt oder ist unsicher",
      description:
        "Setze in .env ein starkes, zufälliges AUTH_SECRET (z. B. openssl rand -base64 32). Platzhalter und kurze Werte sind nicht zulässig.",
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

  if (isStudioApiTokenMissing()) {
    warnings.push({
      id: "production:studio-api-token",
      severity: "warning",
      title: "STUDIO_API_TOKEN nicht gesetzt",
      description:
        "Empfohlen bei exponiertem Studio: Bearer-Token für sensible APIs (Backup, Restore, Settings, AI) setzen.",
      href: "/settings",
    });
  }

  warnings.push({
    id: "production:studio-exposure",
    severity: "critical",
    title: "Studio ohne Login — nur hinter Schutz betreiben",
    description:
      "Studio niemals direkt öffentlich erreichbar machen. Nutze Reverse-Proxy-Auth, VPN oder Cloudflare Access.",
  });

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
