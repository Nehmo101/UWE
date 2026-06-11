import { randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "uwe_session";
export const PREVIEW_COOKIE_NAME = "uwe_preview_as";
export const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function sessionExpiresAt(ttlMs: number = DEFAULT_SESSION_TTL_MS): Date {
  return new Date(Date.now() + ttlMs);
}
