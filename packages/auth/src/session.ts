export const SESSION_COOKIE_NAME = "uwe_session";
export const PREVIEW_COOKIE_NAME = "uwe_preview_as";
export const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export function sessionExpiresAt(ttlMs: number = DEFAULT_SESSION_TTL_MS): Date {
  return new Date(Date.now() + ttlMs);
}

/**
 * All `uwe_session` values contained in a raw `Cookie` header, ordered LAST-first.
 *
 * A browser sends one `Cookie` entry per stored cookie, so the same name can appear
 * more than once when the same session was written under different scopes (host-only
 * vs. `SESSION_COOKIE_DOMAIN`). Next's `RequestCookies` — behind `cookies()` and
 * `NextRequest.cookies` — collapses those into a Map and therefore yields the LAST
 * occurrence. Reading only the first one (`.find()`) picks a different, usually stale
 * token than the page path, which authenticates the page while every API guard 401s.
 *
 * Returning every candidate last-first keeps parity with Next for the common case and
 * lets callers recover from a poisoned cookie jar by trying the remaining tokens.
 */
export function readSessionTokensFromCookieHeader(cookieHeader: string | null | undefined): string[] {
  if (!cookieHeader) {
    return [];
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    .map((part) => part.slice(SESSION_COOKIE_NAME.length + 1))
    .map((value) => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    })
    .filter((value) => value.trim().length > 0)
    .reverse();
}
