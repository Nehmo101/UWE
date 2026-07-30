import {
  getTurnstileConfig,
  resolveBrainPublicBaseUrl,
  resolveFamilyPublicBaseUrl,
  resolvePortalPublicBaseUrl,
  resolveStudioPublicBaseUrl,
} from "@uwe/auth";
import { UweLandingPage, dayIndex } from "@uwe/shared-ui";
import { getCurrentAuthUser } from "@/src/lib/auth";

// Die öffentliche Startseite liest Studio-/Portal-/Brain-/Family-Origin und den
// Turnstile-Key aus der Laufzeit-Umgebung — deshalb pro Anfrage rendern.
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getCurrentAuthUser();

  // Der Apex zeigt die Startseite — auch dem, der schon angemeldet ist. Früher
  // leitete er dann sofort ins Studio weiter; damit war die Startseite für den
  // eigenen Betreiber unerreichbar, sobald er eine Sitzung hatte. Sie ist aber
  // genau der Ort, von dem aus man zwischen den Apps wechselt.
  //
  // `signedIn` sorgt dafür, dass eine Produktkarte dann direkt in die App führt
  // statt in eine zweite Anmeldung: die Sitzung gilt über SESSION_COOKIE_DOMAIN
  // ohnehin auf allen Subdomains.
  const turnstile = getTurnstileConfig();
  return (
    <UweLandingPage
      signedIn={Boolean(user)}
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
