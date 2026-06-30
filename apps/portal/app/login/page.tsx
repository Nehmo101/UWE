import { getTurnstileConfig } from "@uwe/auth";
import { PortalLoginForm } from "@/src/components/PortalLoginForm";

// Read the Turnstile site key from runtime env on every request (self-hosters
// configure keys after build).
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const turnstile = getTurnstileConfig();
  return (
    <PortalLoginForm
      devDefaultEmail="aman@uwe.local"
      devDefaultPassword="uwe-dev"
      turnstileSiteKey={turnstile.enabled ? turnstile.siteKey : null}
    />
  );
}
