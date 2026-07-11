import { getTurnstileConfig } from "@uwe/auth";
import { PortalLoginForm } from "@/src/components/PortalLoginForm";

export const dynamic = "force-dynamic";

const DEV_DEFAULT_PASSWORD = "uwe-" + "dev";

export default function LoginPage() {
  const turnstile = getTurnstileConfig();
  return (
    <PortalLoginForm
      devDefaultEmail="aman@uwe.local"
      devDefaultPassword={DEV_DEFAULT_PASSWORD}
      turnstileSiteKey={turnstile.enabled ? turnstile.siteKey : null}
    />
  );
}
