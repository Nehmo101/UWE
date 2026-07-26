import { getTurnstileConfig, resolveStudioPublicBaseUrl } from "@uwe/auth";
import { getSystemSettingsSnapshotSafe } from "@uwe/database/settings-service";
import { resolveLoginMethodsPublicConfig } from "@uwe/database/login-methods-settings";
import { PortalLoginForm } from "@/src/components/PortalLoginForm";

export const dynamic = "force-dynamic";

const DEV_DEFAULT_PASSWORD = "uwe-" + "dev";

export default async function LoginPage() {
  const turnstile = getTurnstileConfig();
  const { settings } = await getSystemSettingsSnapshotSafe();
  const loginMethods = resolveLoginMethodsPublicConfig(settings.auth);
  return (
    <PortalLoginForm
      devDefaultEmail="aman@uwe.local"
      devDefaultPassword={DEV_DEFAULT_PASSWORD}
      turnstileSiteKey={turnstile.enabled ? turnstile.siteKey : null}
      passkeysEnabled={loginMethods.passkeysEnabled}
      googleLoginEnabled={loginMethods.googleLoginEnabled}
      googleStartUrl={`${resolveStudioPublicBaseUrl()}/api/auth/google/start?target=portal`}
    />
  );
}
