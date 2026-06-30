import { getTurnstileConfig } from "@uwe/auth";
import { StudioLoginForm } from "@/src/components/StudioLoginForm";
import { StudioLoginFooter } from "@/components/StudioLoginFooter";
import { STUDIO_DASHBOARD_PATH } from "@/src/lib/routes";

// Read the Turnstile site key from runtime env on every request (self-hosters
// configure keys after build).
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const turnstile = getTurnstileConfig();
  return (
    <StudioLoginForm
      title="UWE Studio — Anmeldung"
      lead="Interne Schutzschicht für den Welten-Editor. Cloudflare Access bleibt die äußere Schutzschicht."
      defaultRedirect={STUDIO_DASHBOARD_PATH}
      forcePasswordRedirect="/account/password"
      devDefaultEmail="dm@uwe.local"
      devDefaultPassword="uwe-dev"
      footer={<StudioLoginFooter />}
      turnstileSiteKey={turnstile.enabled ? turnstile.siteKey : null}
      devCredentials={
        <>
          <p className="font-medium">Entwicklungs-Benutzer</p>
          <p className="text-muted-foreground">DM: dm@uwe.local / uwe-dev</p>
        </>
      }
    />
  );
}
