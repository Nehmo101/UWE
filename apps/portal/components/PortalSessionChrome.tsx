import { headers } from "next/headers";
import { getCurrentUser, getSessionToken } from "@/src/lib/auth";
import { getSystemSettingsSnapshotSafe, resolveSessionInactivityTimeoutMs } from "@uwe/database/settings-service";
import { SessionIdleGuard } from "@uwe/shared-ui";

const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/logout"] as const;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function PortalSessionChrome() {
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

  if (inactivityTimeoutMs <= 0) {
    return null;
  }

  return (
    <SessionIdleGuard
      timeoutMs={inactivityTimeoutMs}
      logoutRedirect="/login?reason=idle"
    />
  );
}
