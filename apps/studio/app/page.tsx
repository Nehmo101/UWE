import {
  getTurnstileConfig,
  getUweDeploymentModel,
  resolveBrainPublicBaseUrl,
  resolveFamilyPublicBaseUrl,
  resolvePortalPublicBaseUrl,
  resolveStudioPublicBaseUrl,
} from "@uwe/auth";
import { getAppRepository } from "@uwe/database/server";
import { UweLandingPage, dayIndex } from "@uwe/shared-ui";
import { redirect } from "next/navigation";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { resolveStudioLandingPath } from "@/src/lib/studio-landing";

// Rendert je nach Deployment-Modell die Landing oder leitet weiter — beides
// liest Laufzeit-Env und Systemeinstellungen, deshalb pro Anfrage rendern.
export const dynamic = "force-dynamic";

/**
 * Wurzel des Studio-Origins.
 *
 * Bei getrennten Hostnamen (studio./portal.uwe.example) liegt die
 * öffentliche Startseite in ihrer eigenen App auf dem Apex (`apps/landing`) —
 * Studio zeigt hier deshalb keine Landing mehr, sondern führt direkt in den
 * Arbeitsbereich bzw. zum Login. Ohne getrennte Hostnamen (unified-path oder
 * lokale Entwicklung) bleibt `/` wie bisher die Landing, sonst hätte diese
 * Betriebsart gar keinen Einstieg mehr.
 */
export default async function StudioRootPage() {
  const user = await getCurrentAuthUser();

  if (getUweDeploymentModel() === "split-hostname") {
    if (!user) {
      redirect("/login");
    }
    const settings = await getAppRepository().getSystemSettings();
    redirect(resolveStudioLandingPath(settings.app.defaultLandingPage));
  }

  if (user) {
    const settings = await getAppRepository().getSystemSettings();
    redirect(resolveStudioLandingPath(settings.app.defaultLandingPage));
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
