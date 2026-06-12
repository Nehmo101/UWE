/**
 * Spotify OAuth helpers (Authorization Code Flow + refresh).
 *
 * @see https://developer.spotify.com/documentation/web-api/tutorials/code-flow
 */

export const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

/** Scopes required for Web API playback control. */
export const SPOTIFY_PLAYBACK_SCOPES = [
  "user-modify-playback-state",
  "user-read-playback-state",
] as const;

export interface SpotifyOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface SpotifyTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export type SpotifyFetch = typeof fetch;

export interface SpotifyOAuthError {
  ok: false;
  error: string;
  status?: number;
}

export type SpotifyOAuthResult =
  | { ok: true; tokens: SpotifyTokenSet }
  | SpotifyOAuthError;

export type SpotifyRefreshResult =
  | { ok: true; accessToken: string; expiresAt: Date; refreshToken?: string }
  | SpotifyOAuthError;

/** Refresh access tokens this many milliseconds before expiry. */
export const SPOTIFY_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export function computeTokenExpiry(
  expiresInSeconds: number,
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() + expiresInSeconds * 1000);
}

export function shouldRefreshSpotifyToken(
  expiresAt: Date,
  now: Date = new Date(),
  bufferMs: number = SPOTIFY_TOKEN_REFRESH_BUFFER_MS,
): boolean {
  return expiresAt.getTime() - now.getTime() <= bufferMs;
}

export function buildSpotifyAuthorizationUrl(
  config: SpotifyOAuthConfig,
  state: string,
  scopes: readonly string[] = SPOTIFY_PLAYBACK_SCOPES,
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: scopes.join(" "),
    state,
    show_dialog: "false",
  });

  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeSpotifyAuthorizationCode(
  config: SpotifyOAuthConfig,
  code: string,
  fetchImpl: SpotifyFetch = fetch,
): Promise<SpotifyOAuthResult> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });

  const response = await fetchImpl(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodeBasicAuth(config.clientId, config.clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  return parseTokenResponse(response, { requireRefreshToken: true });
}

export async function refreshSpotifyAccessToken(
  config: Pick<SpotifyOAuthConfig, "clientId" | "clientSecret">,
  refreshToken: string,
  fetchImpl: SpotifyFetch = fetch,
): Promise<SpotifyRefreshResult> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetchImpl(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodeBasicAuth(config.clientId, config.clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const parsed = await parseTokenResponse(response, { requireRefreshToken: false });
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    accessToken: parsed.tokens.accessToken,
    expiresAt: parsed.tokens.expiresAt,
    refreshToken: parsed.tokens.refreshToken,
  };
}

function encodeBasicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function parseTokenResponse(
  response: Response,
  options: { requireRefreshToken?: boolean } = {},
): Promise<SpotifyOAuthResult> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      error: "Spotify token response was not valid JSON.",
      status: response.status,
    };
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error_description" in payload &&
      typeof (payload as { error_description?: unknown }).error_description === "string"
        ? (payload as { error_description: string }).error_description
        : typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof (payload as { error?: unknown }).error === "string"
          ? (payload as { error: string }).error
          : `Spotify token request failed (${response.status}).`;

    return { ok: false, error: message, status: response.status };
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as { access_token?: unknown }).access_token !== "string" ||
    typeof (payload as { expires_in?: unknown }).expires_in !== "number"
  ) {
    return {
      ok: false,
      error: "Spotify token response is missing required fields.",
      status: response.status,
    };
  }

  const data = payload as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
  };

  if (options.requireRefreshToken !== false && !data.refresh_token) {
    return {
      ok: false,
      error: "Spotify did not return a refresh token.",
      status: response.status,
    };
  }

  return {
    ok: true,
    tokens: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? "",
      expiresAt: computeTokenExpiry(data.expires_in),
      scope: data.scope ?? SPOTIFY_PLAYBACK_SCOPES.join(" "),
    },
  };
}
