import {
  getTurnstileConfig,
  resolvePortalPublicBaseUrl,
  resolveStudioPublicBaseUrl,
} from "@uwe/auth";
import { UweLandingPage } from "@uwe/shared-ui";

// The public landing (uweanddragons.org) is served from the Studio/apex origin.
// It reads the Studio/Portal origins and Turnstile key from runtime env, so
// render it per-request.
export const dynamic = "force-dynamic";

export default function LandingPage() {
  const turnstile = getTurnstileConfig();
  return (
    <UweLandingPage
      studioAppUrl={resolveStudioPublicBaseUrl()}
      portalAppUrl={resolvePortalPublicBaseUrl()}
      turnstileSiteKey={turnstile.enabled ? turnstile.siteKey : null}
      rtxOnline
    />
  );
}
