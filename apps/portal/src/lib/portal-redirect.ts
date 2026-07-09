const DEFAULT_POST_AUTH_PATH = "/auth/worlds";

/**
 * Restrict post-login redirects to same-origin relative paths (open-redirect safe).
 */
export function sanitizePortalRedirectPath(
  redirect: string | null | undefined,
  fallback = DEFAULT_POST_AUTH_PATH,
): string {
  if (!redirect || typeof redirect !== "string") {
    return fallback;
  }

  const trimmed = redirect.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  if (trimmed.includes("://") || trimmed.includes("\\")) {
    return fallback;
  }

  return trimmed;
}

export function buildPortalLoginUrl(
  destination: string,
  fallback = DEFAULT_POST_AUTH_PATH,
): string {
  const safeDestination = sanitizePortalRedirectPath(destination, fallback);
  return `/login?redirect=${encodeURIComponent(safeDestination)}`;
}

export function portalReturnPath(pathname: string, search = ""): string {
  return `${pathname}${search}`;
}
