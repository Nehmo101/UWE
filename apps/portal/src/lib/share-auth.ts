import { cookies } from "next/headers";
import type { SessionCookieOptions } from "@uwe/auth";
import { getSessionCookieOptions, getSessionCookieOptionsForRequest } from "@uwe/auth";

export const SHARE_AUTH_COOKIE_PREFIX = "uwe_share_";

export function shareAuthCookieName(token: string): string {
  return `${SHARE_AUTH_COOKIE_PREFIX}${token}`;
}

export async function isSharePasswordVerified(token: string): Promise<boolean> {
  const store = await cookies();
  return store.get(shareAuthCookieName(token))?.value === "ok";
}

function buildShareAuthCookieOptions(
  token: string,
  cookie: SessionCookieOptions,
  maxAgeSeconds: number,
) {
  return {
    name: shareAuthCookieName(token),
    value: "ok",
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    secure: cookie.secure,
    // Path must cover both /share/[token]/* pages and /api/share/[token]/*
    // file routes; the cookie name is already scoped to the token.
    path: cookie.path,
    maxAge: maxAgeSeconds,
  };
}

export function shareAuthCookieOptions(
  token: string,
  maxAgeSeconds = 60 * 60 * 24,
  request?: Pick<Request, "url" | "headers">,
) {
  const cookie = request
    ? getSessionCookieOptionsForRequest(request)
    : getSessionCookieOptions();
  return buildShareAuthCookieOptions(token, cookie, maxAgeSeconds);
}
