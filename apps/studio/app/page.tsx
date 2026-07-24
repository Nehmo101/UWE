import {
  getTurnstileConfig,
  resolveBrainPublicBaseUrl,
  resolvePortalPublicBaseUrl,
  resolveStudioPublicBaseUrl,
} from "@uwe/auth";
import { getAppRepository } from "@uwe/database/server";
import { UweLandingPage, dayIndex } from "@uwe/shared-ui";
import { redirect } from "next/navigation";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { resolveStudioLandingPath } from "@/src/lib/studio-landing";

// The public landing (uweanddragons.org) is served from the Studio/apex origin.
// It reads the Studio/Portal origins and Turnstile key from runtime env, so
// render it per-request.
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getCurrentAuthUser();
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
      turnstileSiteKey={turnstile.enabled ? turnstile.siteKey : null}
      rtxOnline
      // Serverseitig berechnet und durchgereicht: ein clientseitiger Wert
      // erzeugte um Mitternacht bzw. bei abweichender Serverzone einen
      // Hydration-Mismatch.
      sceneIndex={dayIndex()}
    />
  );
}
