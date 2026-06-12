import { createHash } from "node:crypto";

export const SPOTIFY_STATE_COOKIE = "uwe_spotify_oauth_state";

export interface SpotifyOAuthState {
  worldSlug: string;
  nonce: string;
}

export function encodeOAuthState(state: SpotifyOAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

export function decodeOAuthState(value: string): SpotifyOAuthState | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SpotifyOAuthState;
    if (!parsed.worldSlug || !parsed.nonce) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hashStateCookieValue(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}

export function verifySpotifyOAuthState(
  stateParam: string | null,
  cookieValue: string | undefined,
): { ok: true; state: SpotifyOAuthState } | { ok: false; reason: string } {
  if (!stateParam) {
    return { ok: false, reason: "OAuth-Status fehlt." };
  }

  const state = decodeOAuthState(stateParam);
  if (!state) {
    return { ok: false, reason: "Ungültiger OAuth-Status." };
  }

  const expectedCookie = cookieValue;
  const actualHash = hashStateCookieValue(state.nonce);

  if (!expectedCookie || expectedCookie !== actualHash) {
    return { ok: false, reason: "OAuth-Status konnte nicht verifiziert werden." };
  }

  return { ok: true, state };
}
