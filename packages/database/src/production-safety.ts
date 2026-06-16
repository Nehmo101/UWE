import { isWeakSecret as isWeakAuthSecret } from "@uwe/env";
import type { PrismaClient } from "./client";
import type { InspectorSeverity } from "./world-inspector";
import { SettingsService, type UweSystemSettings } from "./settings-service";
import {
  getUweRuntimeConfig,
  isPublicExposureConfigured,
} from "@uwe/auth";

export interface ProductionSafetyWarning {
  id: string;
  severity: InspectorSeverity;
  title: string;
  description: string;
  href?: string;
}

export { isWeakAuthSecret };

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

  if (isStudioApiTokenMissing()) {
    warnings.push({
      id: "production:studio-api-token",
      severity: isPublicExposureConfigured() ? "critical" : "warning",
      title: "STUDIO_API_TOKEN nicht gesetzt",
      description: isPublicExposureConfigured()
        ? "Öffentliche Erreichbarkeit (PUBLIC_APP_URL/CLOUDFLARE_TUNNEL) erkannt — setze STUDIO_API_TOKEN und schütze Studio zusätzlich mit Cloudflare Access oder Reverse-Proxy-Auth."
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

  warnings.push({
    id: "production:studio-exposure",
    severity: isPublicExposureConfigured() ? "critical" : "critical",
    title: "Studio ohne Login — nur hinter Schutz betreiben",
    description: isPublicExposureConfigured()
      ? "Studio ist über Cloudflare/Proxy erreichbar, hat aber kein Benutzer-Login. Nutze Cloudflare Access, Reverse-Proxy-Auth oder VPN — und setze STUDIO_API_TOKEN."
      : "Studio niemals direkt öffentlich erreichbar machen. Nutze Reverse-Proxy-Auth, VPN oder Cloudflare Access.",
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
