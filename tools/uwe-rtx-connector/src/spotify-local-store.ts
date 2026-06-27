/**
 * Connector-local Spotify session store + playback helpers.
 *
 * Spotify OAuth lives ONLY on the RTX Connector Client (never on the UWE host).
 * The user authenticates once here; the resulting tokens are persisted to
 * `<dataDir>/spotify-session.json` and refreshed on demand using the OAuth
 * helpers from `@uwe/soundboard`. The host only ever enqueues Spotify jobs that
 * this connector executes locally with the stored token.
 *
 * Privacy: tokens are stored on disk in the user's local app data and are NEVER
 * written to logs or returned to the caller. CLI/UI surfaces only see device
 * lists, connection flags, and human-readable status messages.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  buildSpotifyAuthorizationUrl,
  exchangeSpotifyAuthorizationCode,
  listSpotifyDevices,
  pauseSpotifyPlayback,
  refreshSpotifyAccessToken,
  resumeSpotifyPlayback,
  shouldRefreshSpotifyToken,
  transferSpotifyPlayback,
  type SpotifyDevice,
  type SpotifyOAuthConfig,
} from "@uwe/soundboard";

export const SPOTIFY_SESSION_FILENAME = "spotify-session.json";

/** Persisted Spotify session. Never logged. */
export interface SpotifySession {
  accessToken: string;
  refreshToken: string;
  /** ISO-8601 access-token expiry. */
  expiresAt: string;
  /** Preferred Spotify Connect device id, when chosen. */
  deviceId: string | null;
}

export interface SpotifyLocalConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function spotifySessionPath(dataDir: string): string {
  return join(dataDir, SPOTIFY_SESSION_FILENAME);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Load the persisted Spotify session, or null when absent/corrupt. */
export function loadSpotifySession(dataDir: string): SpotifySession | null {
  let contents: string;
  try {
    contents = readFileSync(spotifySessionPath(dataDir), "utf8");
  } catch {
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(contents);
  } catch {
    return null;
  }

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return null;
  }

  const input = json as Record<string, unknown>;
  const accessToken = asString(input.accessToken);
  const refreshToken = asString(input.refreshToken);
  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: asString(input.expiresAt) || new Date(0).toISOString(),
    deviceId: typeof input.deviceId === "string" && input.deviceId.trim() ? input.deviceId : null,
  };
}

/** Persist the Spotify session, creating the data directory if needed. */
export function saveSpotifySession(dataDir: string, session: SpotifySession): void {
  const path = spotifySessionPath(dataDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

/** Remove the persisted Spotify session (disconnect). Safe when absent. */
export function clearSpotifySession(dataDir: string): void {
  try {
    rmSync(spotifySessionPath(dataDir), { force: true });
  } catch {
    // Already gone — nothing to clear.
  }
}

function oauthConfig(config: SpotifyLocalConfig): SpotifyOAuthConfig {
  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  };
}

export class SpotifyLocalStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpotifyLocalStoreError";
  }
}

function requireCredentials(config: SpotifyLocalConfig): void {
  if (!config.clientId || !config.clientSecret) {
    throw new SpotifyLocalStoreError(
      "Spotify-Zugangsdaten fehlen — Client-ID und Client-Secret im RTX-Client speichern.",
    );
  }
}

/** Build the Spotify authorization URL the user opens to grant access. */
export function buildAuthorizationUrl(config: SpotifyLocalConfig, state: string): string {
  requireCredentials(config);
  return buildSpotifyAuthorizationUrl(oauthConfig(config), state);
}

/**
 * Exchange an authorization code for tokens and persist them. Returns only a
 * status flag — never the tokens themselves.
 */
export async function exchangeCodeAndStore(
  dataDir: string,
  config: SpotifyLocalConfig,
  code: string,
): Promise<{ ok: boolean; message: string }> {
  requireCredentials(config);

  const result = await exchangeSpotifyAuthorizationCode(oauthConfig(config), code.trim());
  if (!result.ok) {
    return { ok: false, message: result.error };
  }

  const existing = loadSpotifySession(dataDir);
  saveSpotifySession(dataDir, {
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    expiresAt: result.tokens.expiresAt.toISOString(),
    deviceId: existing?.deviceId ?? null,
  });

  return { ok: true, message: "Spotify verbunden." };
}

/**
 * Return a valid access token, refreshing (and persisting) it first when the
 * stored token is missing or close to expiry. Returns null when the connector
 * has no Spotify session yet.
 */
export async function getValidAccessToken(
  dataDir: string,
  config: SpotifyLocalConfig,
): Promise<{ accessToken: string; deviceId: string | null } | null> {
  const session = loadSpotifySession(dataDir);
  if (!session) {
    return null;
  }

  if (!shouldRefreshSpotifyToken(new Date(session.expiresAt))) {
    return { accessToken: session.accessToken, deviceId: session.deviceId };
  }

  requireCredentials(config);
  const refreshed = await refreshSpotifyAccessToken(oauthConfig(config), session.refreshToken);
  if (!refreshed.ok) {
    throw new SpotifyLocalStoreError(refreshed.error);
  }

  const next: SpotifySession = {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? session.refreshToken,
    expiresAt: refreshed.expiresAt.toISOString(),
    deviceId: session.deviceId,
  };
  saveSpotifySession(dataDir, next);

  return { accessToken: next.accessToken, deviceId: next.deviceId };
}

export interface SpotifyDevicesResult {
  ok: boolean;
  connected: boolean;
  devices: SpotifyDevice[];
  deviceId: string | null;
  message?: string;
}

/** List the user's Spotify Connect devices using a valid stored token. */
export async function listDevices(
  dataDir: string,
  config: SpotifyLocalConfig,
): Promise<SpotifyDevicesResult> {
  const token = await getValidAccessToken(dataDir, config);
  if (!token) {
    return {
      ok: false,
      connected: false,
      devices: [],
      deviceId: null,
      message: "Spotify ist nicht verbunden.",
    };
  }

  const result = await listSpotifyDevices({ accessToken: token.accessToken });
  return {
    ok: result.ok,
    connected: true,
    devices: result.devices ?? [],
    deviceId: token.deviceId,
    message: result.message,
  };
}

/** Persist the preferred Spotify Connect device id. */
export function setDevice(dataDir: string, deviceId: string | null): { ok: boolean; message: string } {
  const session = loadSpotifySession(dataDir);
  if (!session) {
    return { ok: false, message: "Spotify ist nicht verbunden." };
  }

  saveSpotifySession(dataDir, { ...session, deviceId: deviceId?.trim() || null });
  return { ok: true, message: deviceId ? "Spotify-Gerät gesetzt." : "Spotify-Gerät zurückgesetzt." };
}

export interface SpotifyTestResult {
  ok: boolean;
  message: string;
}

/**
 * Verify playback control by transferring to the stored device (when set) and
 * issuing a benign play/pause. Used by the "Test" button in the client UI.
 */
export async function testPlayback(
  dataDir: string,
  config: SpotifyLocalConfig,
  action: "play" | "pause" = "pause",
): Promise<SpotifyTestResult> {
  const token = await getValidAccessToken(dataDir, config);
  if (!token) {
    return { ok: false, message: "Spotify ist nicht verbunden." };
  }

  if (token.deviceId) {
    const transfer = await transferSpotifyPlayback({
      accessToken: token.accessToken,
      deviceId: token.deviceId,
    });
    if (!transfer.ok) {
      return { ok: false, message: transfer.message };
    }
  }

  const result =
    action === "play"
      ? await resumeSpotifyPlayback({ accessToken: token.accessToken })
      : await pauseSpotifyPlayback({ accessToken: token.accessToken });

  return { ok: result.ok, message: result.message };
}
