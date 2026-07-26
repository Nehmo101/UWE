import { getTurnstileConfig } from "@uwe/auth";
import { getSystemSettingsSnapshotSafe } from "@uwe/database/settings-service";
import { PortalLoginForm } from "@/src/components/PortalLoginForm";

export const dynamic = "force-dynamic";

const DEV_DEFAULT_PASSWORD = "uwe-" + "dev";

export default async function LoginPage() {
  const turnstile = getTurnstileConfig();
  const { settings } = await getSystemSettingsSnapshotSafe();
  return (
    <PortalLoginForm
      devDefaultEmail="aman@uwe.local"
      devDefaultPassword={DEV_DEFAULT_PASSWORD}
      turnstileSiteKey={turnstile.enabled ? turnstile.siteKey : null}
      passkeysEnabled={settings.auth.passkeysEnabled}
    />
  );
}
