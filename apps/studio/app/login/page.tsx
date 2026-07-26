import { getTurnstileConfig } from "@uwe/auth";
import { getAppRepository } from "@uwe/database/server";
import { resolveLoginMethodsPublicConfig } from "@uwe/database/login-methods-settings";
import { StudioLoginForm } from "@/src/components/StudioLoginForm";
import { StudioLoginFooter } from "@/components/StudioLoginFooter";
import { STUDIO_DASHBOARD_PATH } from "@/src/lib/routes";

// Read the Turnstile site key from runtime env on every request (self-hosters
// configure keys after build).
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const turnstile = getTurnstileConfig();
  const settings = await getAppRepository().getSystemSettings();
  const loginMethods = resolveLoginMethodsPublicConfig(settings.auth);
  return (
    <StudioLoginForm
      title="UWE Studio — Anmeldung"
      lead="Interne Schutzschicht für den Welten-Editor."
      defaultRedirect={STUDIO_DASHBOARD_PATH}
      forcePasswordRedirect="/account/password"
      devDefaultEmail="dm@uwe.local"
      devDefaultPassword="uwe-dev"
      footer={<StudioLoginFooter />}
      turnstileSiteKey={turnstile.enabled ? turnstile.siteKey : null}
      passkeysEnabled={loginMethods.passkeysEnabled}
      googleLoginEnabled={loginMethods.googleLoginEnabled}
      googleStartUrl="/api/auth/google/start?target=studio"
      devCredentials={
        <>
          <p className="font-medium">Entwicklungs-Benutzer</p>
          <p className="text-muted-foreground">DM: dm@uwe.local / uwe-dev</p>
        </>
      }
    />
  );
}
