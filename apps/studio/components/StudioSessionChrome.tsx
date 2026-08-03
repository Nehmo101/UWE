import { StudioAuthChrome } from "@/src/components/shell/StudioAuthChrome";
import { getCurrentUser, getSessionToken, studioAuthRequired } from "@/src/lib/auth";
import { resolveLandingPublicBaseUrl } from "@uwe/auth";
import { getSystemSettingsSnapshotSafe, resolveSessionInactivityTimeoutMs } from "@uwe/database/settings-service";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/setup",
  "/logout",
] as const;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function StudioSessionChrome() {
  if (!studioAuthRequired()) {
    return null;
  }

  const { headers } = await import("next/headers");
  const headersList = await headers();
  const pathname = headersList.get("x-uwe-pathname") ?? "/";
  if (isPublicPath(pathname)) {
    return null;
  }

  const [user, token] = await Promise.all([getCurrentUser(), getSessionToken()]);
  if (!user || !token) {
    return null;
  }

  const { settings } = await getSystemSettingsSnapshotSafe();
  const inactivityTimeoutMs = resolveSessionInactivityTimeoutMs(settings);

  const startHref = resolveLandingPublicBaseUrl();

  return (
    <StudioAuthChrome
      user={{ displayName: user.displayName }}
      startHref={startHref}
      inactivityTimeoutMs={inactivityTimeoutMs}
      logoutRedirect="/login"
    />
  );
}
