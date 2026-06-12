import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const SPOTIFY_SCOPES = [
  "user-modify-playback-state",
  "user-read-playback-state",
] as const;

export interface SpotifyStoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  updatedAt: string;
}

export interface SpotifyAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface SpotifyConnectionStatus {
  configured: boolean;
  connected: boolean;
  expiresAt: number | null;
  scope: string | null;
}

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

function resolveTokenStorePath(): string {
  const dataDir = process.env.UWE_DATA_DIR?.trim() || path.join(process.cwd(), "data");
  return path.join(dataDir, "spotify-oauth.json");
}

export function getSpotifyAuthConfig(): SpotifyAuthConfig | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }

  const studioUrl = process.env.NEXT_PUBLIC_STUDIO_URL?.trim() || "http://localhost:3000";
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI?.trim() ||
    `${studioUrl.replace(/\/$/, "")}/api/spotify/callback`;

  return { clientId, clientSecret, redirectUri };
}

export function createSpotifyOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export function buildSpotifyAuthorizeUrl(state: string): string {
  const config = getSpotifyAuthConfig();
  if (!config) {
    throw new Error("Spotify OAuth ist nicht konfiguriert (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET).");
  }

  const url = new URL(SPOTIFY_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", SPOTIFY_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("show_dialog", "false");

  return url.toString();
}

export async function readStoredSpotifyTokens(): Promise<SpotifyStoredTokens | null> {
  try {
    const raw = await readFile(resolveTokenStorePath(), "utf8");
    const parsed = JSON.parse(raw) as SpotifyStoredTokens;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveStoredSpotifyTokens(tokens: SpotifyStoredTokens): Promise<void> {
  const filePath = resolveTokenStorePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(tokens, null, 2), "utf8");
}

export async function clearStoredSpotifyTokens(): Promise<void> {
  await saveStoredSpotifyTokens({
    accessToken: "",
    refreshToken: "",
    expiresAt: 0,
    scope: "",
    updatedAt: new Date(0).toISOString(),
  });
}

async function requestSpotifyTokens(
  body: URLSearchParams,
): Promise<SpotifyStoredTokens> {
  const config = getSpotifyAuthConfig();
  if (!config) {
    throw new Error("Spotify OAuth ist nicht konfiguriert.");
  }

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token || !payload.expires_in) {
    const detail = payload.error_description ?? payload.error ?? `HTTP ${response.status}`;
    throw new Error(`Spotify-Token-Austausch fehlgeschlagen: ${detail}`);
  }

  const existing = await readStoredSpotifyTokens();
  const refreshToken = payload.refresh_token ?? existing?.refreshToken;
  if (!refreshToken) {
    throw new Error("Spotify lieferte kein Refresh-Token — bitte erneut verbinden.");
  }

  const tokens: SpotifyStoredTokens = {
    accessToken: payload.access_token,
    refreshToken,
    expiresAt: Date.now() + payload.expires_in * 1000,
    scope: payload.scope ?? SPOTIFY_SCOPES.join(" "),
    updatedAt: new Date().toISOString(),
  };

  await saveStoredSpotifyTokens(tokens);
  return tokens;
}

export async function exchangeSpotifyAuthorizationCode(code: string): Promise<SpotifyStoredTokens> {
  const config = getSpotifyAuthConfig();
  if (!config) {
    throw new Error("Spotify OAuth ist nicht konfiguriert.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });

  return requestSpotifyTokens(body);
}

export async function refreshSpotifyAccessToken(
  refreshToken: string,
): Promise<SpotifyStoredTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  return requestSpotifyTokens(body);
}

export async function getValidSpotifyAccessToken(): Promise<string | null> {
  const stored = await readStoredSpotifyTokens();
  if (!stored?.accessToken || !stored.refreshToken) {
    return null;
  }

  const refreshThresholdMs = 60_000;
  if (stored.expiresAt - Date.now() > refreshThresholdMs) {
    return stored.accessToken;
  }

  try {
    const refreshed = await refreshSpotifyAccessToken(stored.refreshToken);
    return refreshed.accessToken;
  } catch {
    return null;
  }
}

export async function getSpotifyConnectionStatus(): Promise<SpotifyConnectionStatus> {
  const configured = getSpotifyAuthConfig() !== null;
  const stored = await readStoredSpotifyTokens();
  const connected = Boolean(stored?.accessToken && stored.refreshToken && stored.expiresAt > 0);

  return {
    configured,
    connected,
    expiresAt: connected ? stored!.expiresAt : null,
    scope: connected ? stored!.scope : null,
  };
}

export function sanitizeSpotifyReturnPath(returnTo: string | null | undefined): string {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/";
  }
  return returnTo;
}
