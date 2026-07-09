/** Cookie storing the last visited sub-route per world (Studio cockpit). */
export function worldLastRouteCookieName(worldSlug: string): string {
  return `uwe_world_route_${worldSlug}`;
}

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

/** Validates that a stored path is a safe in-world sub-route (not the world root). */
export function isValidWorldLastRoute(worldSlug: string, path: string): boolean {
  if (!path.startsWith("/")) return false;
  const base = `/worlds/${worldSlug}`;
  const normalized = path.split("?")[0]!.replace(/\/$/, "");
  if (normalized === base) return false;
  return normalized.startsWith(`${base}/`);
}

/** Resolve redirect target from an optional cookie value. */
export function resolveWorldLastRoute(worldSlug: string, cookieValue?: string): string | null {
  if (!cookieValue) return null;
  try {
    const decoded = decodeURIComponent(cookieValue);
    return isValidWorldLastRoute(worldSlug, decoded) ? decoded : null;
  } catch {
    return null;
  }
}

/** Client-side: persist the current world sub-route. */
export function persistWorldLastRoute(worldSlug: string, pathname: string): void {
  if (typeof document === "undefined") return;
  const normalized = pathname.split("?")[0]!.replace(/\/$/, "") || pathname;
  if (!isValidWorldLastRoute(worldSlug, normalized)) return;
  const name = worldLastRouteCookieName(worldSlug);
  document.cookie = `${name}=${encodeURIComponent(normalized)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

/** Wiki listing path after world-root redirect (#639). */
export function worldWikiPath(worldSlug: string): string {
  return `/worlds/${worldSlug}/wiki`;
}
