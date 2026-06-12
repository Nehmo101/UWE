import { cookies } from "next/headers";

export const SHARE_AUTH_COOKIE_PREFIX = "uwe_share_";

export function shareAuthCookieName(token: string): string {
  return `${SHARE_AUTH_COOKIE_PREFIX}${token}`;
}

export async function isSharePasswordVerified(token: string): Promise<boolean> {
  const store = await cookies();
  return store.get(shareAuthCookieName(token))?.value === "ok";
}

export function shareAuthCookieOptions(token: string, maxAgeSeconds = 60 * 60 * 24) {
  return {
    name: shareAuthCookieName(token),
    value: "ok",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    // Path must cover both /share/[token]/* pages and /api/share/[token]/*
    // file routes; the cookie name is already scoped to the token.
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
