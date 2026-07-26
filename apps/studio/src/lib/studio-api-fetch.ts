"use client";

import { studioApiUrl } from "./studio-api-url";

/** Paths that answer 401 as part of their own flow and must not bounce. */
const SELF_HANDLED_PREFIXES = ["/login", "/logout", "/setup", "/maintenance"];

/**
 * Target for a 401 seen at `pathname`, or null when the current page handles it itself.
 * Pure so the routing decision is testable without a browser.
 */
export function resolveLoginRedirect(pathname: string, search = ""): string | null {
  const selfHandled = SELF_HANDLED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (selfHandled) {
    return null;
  }

  return `/login?redirect=${encodeURIComponent(`${pathname}${search}`)}`;
}

let redirecting = false;

function redirectToLogin(): void {
  if (redirecting || typeof window === "undefined") {
    return;
  }

  const target = resolveLoginRedirect(window.location.pathname, window.location.search);
  if (!target) {
    return;
  }

  // Latch before navigating: polling panels would otherwise fire one navigation per tick.
  redirecting = true;
  window.location.assign(target);
}

/**
 * Resolve a Studio API path and fetch it, sending the visitor to `/login` on 401.
 *
 * A dead or unreadable session must not present itself as a broken page: the API's
 * auth strings ("Admin-Zugriff erfordert Anmeldung.", "Anmeldung erforderlich.") used
 * to be rendered verbatim into admin panels, which reads like a permission bug rather
 * than a sign-in prompt. Callers still get the response back and keep their own error
 * handling for every other status.
 *
 * Do not use this for the sign-in forms themselves — there a 401 means "wrong password"
 * and belongs in the form, not in a redirect.
 */
export async function studioApiFetch(apiPath: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(studioApiUrl(apiPath), init);

  if (response.status === 401) {
    redirectToLogin();
  }

  return response;
}
