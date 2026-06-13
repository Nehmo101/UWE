import { cookies } from "next/headers";
import { getSessionCookieOptions } from "@uwe/auth";

export const SHARE_AUTH_COOKIE_PREFIX = "uwe_share_";

export function shareAuthCookieName(token: string): string {
  return `${SHARE_AUTH_COOKIE_PREFIX}${token}`;
}

export async function isSharePasswordVerified(token: string): Promise<boolean> {
  const store = await cookies();
  return store.get(shareAuthCookieName(token))?.value === "ok";
}

export function shareAuthCookieOptions(token: string, maxAgeSeconds = 60 * 60 * 24) {
  const cookie = getSessionCookieOptions();
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
