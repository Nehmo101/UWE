import {
  canAccessStudio,
  getTurnstileConfig,
  resolveBrainPublicBaseUrl,
  resolveFamilyPublicBaseUrl,
  resolvePortalPublicBaseUrl,
  resolveStudioPublicBaseUrl,
} from "@uwe/auth";
import {
  getSystemSettingsSnapshotSafe,
  STUDIO_LANDING_PAGE_PATHS,
} from "@uwe/database/settings-service";
import { UweLandingPage, dayIndex } from "@uwe/shared-ui";
import { redirect } from "next/navigation";
import { getCurrentAuthUser } from "@/src/lib/auth";

// Die öffentliche Startseite liest Studio-/Portal-/Brain-/Family-Origin und den
// Turnstile-Key aus der Laufzeit-Umgebung — deshalb pro Anfrage rendern.
export const dynamic = "force-dynamic";

const LANDING_PATHS = new Set<string>(STUDIO_LANDING_PAGE_PATHS);

/**
 * Vom Betreiber gewählte Studio-Einstiegsseite; „/today" als sichere Vorgabe.
 * Liest bewusst den Settings-Snapshot statt `getAppRepository()` — der zöge die
 * gesamte Server-Fassade (bis hin zur Bildverarbeitung) in die Startseite.
 */
async function studioEntryPath(): Promise<string> {
  const { settings } = await getSystemSettingsSnapshotSafe();
  const configured = settings.app.defaultLandingPage?.trim();
  return configured && LANDING_PATHS.has(configured) ? configured : "/worlds";
}

export default async function LandingPage() {
  const user = await getCurrentAuthUser();
  if (user) {
    // Bereits angemeldet: direkt in die passende App statt erneut auswählen zu
    // lassen. Rollenbewusst, weil die Ziele eigene Origins sind — ein Spieler
    // auf studio.uwe.example liefe sonst in dessen Zugriffssperre.
    redirect(
      canAccessStudio(user)
        ? `${resolveStudioPublicBaseUrl()}${await studioEntryPath()}`
        : `${resolvePortalPublicBaseUrl()}/auth/worlds`,
    );
  }

  const turnstile = getTurnstileConfig();
  return (
    <UweLandingPage
      studioAppUrl={resolveStudioPublicBaseUrl()}
      portalAppUrl={resolvePortalPublicBaseUrl()}
      brainAppUrl={resolveBrainPublicBaseUrl()}
      familyAppUrl={resolveFamilyPublicBaseUrl()}
      turnstileSiteKey={turnstile.enabled ? turnstile.siteKey : null}
      // Serverseitig berechnet und durchgereicht: ein clientseitiger Wert
      // erzeugte um Mitternacht bzw. bei abweichender Serverzone einen
      // Hydration-Mismatch.
      sceneIndex={dayIndex()}
    />
  );
}
