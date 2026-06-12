/**
 * Spotify playback adapter via the Spotify Web API.
 *
 * Full playback control requires Spotify Premium and an active Spotify Connect
 * device (Spotify app, desktop client, or Web Player).
 *
 * @see https://developer.spotify.com/documentation/web-api
 */

export type SpotifyResourceType = "track" | "album" | "playlist" | "artist";

export interface ParsedSpotifyUrl {
  type: SpotifyResourceType;
  id: string;
  uri: string;
}

export interface SpotifyPlaybackConfig {
  /** OAuth access token — supplied by the Studio OAuth flow */
  accessToken?: string | null;
  /** Spotify URI or track/album/playlist URL */
  uri: string;
  /** Button volume 0–1, mapped to Spotify 0–100 */
  volume?: number;
}

export interface SpotifyPlaybackResult {
  ok: boolean;
  message: string;
  /** HTTP status from Spotify when the request failed */
  status?: number;
}

export interface SpotifyVolumeConfig {
  accessToken?: string | null;
  /** Button volume 0–1 */
  volume: number;
}

export interface SpotifyTokenConfig {
  accessToken?: string | null;
}

export type SpotifyFetch = typeof fetch;

export interface SpotifyApiClientOptions {
  accessToken: string;
  fetchImpl?: SpotifyFetch;
}

export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

const SPOTIFY_RESOURCE_TYPES = new Set<SpotifyResourceType>([
  "track",
  "album",
  "playlist",
  "artist",
]);

/** Spotify IDs are base62; length varies but is always alphanumeric. */
const SPOTIFY_ID_PATTERN = /^[a-zA-Z0-9]{10,}$/;

function buildParsedSpotifyUrl(type: SpotifyResourceType, id: string): ParsedSpotifyUrl {
  return {
    type,
    id,
    uri: `spotify:${type}:${id}`,
  };
}

function parseSpotifyUri(input: string): ParsedSpotifyUrl | null {
  const match = /^spotify:(track|album|playlist|artist):([a-zA-Z0-9]+)$/i.exec(input);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const type = match[1].toLowerCase() as SpotifyResourceType;
  const id = match[2];
  if (!SPOTIFY_RESOURCE_TYPES.has(type) || !SPOTIFY_ID_PATTERN.test(id)) {
    return null;
  }

  return buildParsedSpotifyUrl(type, id);
}

function parseSpotifyWebUrl(input: string): ParsedSpotifyUrl | null {
  try {
    const parsed = new URL(input);
    if (!parsed.hostname.includes("spotify.com")) {
      return null;
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    for (let index = 0; index < parts.length; index += 1) {
      const candidate = parts[index]?.toLowerCase();
      if (!candidate || !SPOTIFY_RESOURCE_TYPES.has(candidate as SpotifyResourceType)) {
        continue;
      }

      const id = parts[index + 1];
      if (!id || !SPOTIFY_ID_PATTERN.test(id)) {
        return null;
      }

      return buildParsedSpotifyUrl(candidate as SpotifyResourceType, id);
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Parses Spotify web URLs and `spotify:` URIs.
 * Supports locale prefixes such as `/intl-de/track/...` and ignores query parameters.
 */
export function parseSpotifyUrl(input: string): ParsedSpotifyUrl | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("spotify:")) {
    return parseSpotifyUri(trimmed);
  }

  return parseSpotifyWebUrl(trimmed);
}

export function isSpotifyUrl(url: string): boolean {
  return parseSpotifyUrl(url) !== null;
}

export function normalizeSpotifyUri(input: string): string | null {
  return parseSpotifyUrl(input)?.uri ?? null;
}

/** Maps button volume (0–1) to Spotify volume_percent (0–100). */
export function mapButtonVolumeToSpotifyPercent(volume: number): number {
  const clamped = Math.max(0, Math.min(1, volume));
  return Math.round(clamped * 100);
}

/** German UX messages for Spotify Web API error responses. */
export function mapSpotifyHttpError(status: number, bodyText?: string): string {
  const normalizedBody = bodyText?.toLowerCase() ?? "";

  if (status === 401) {
    return "Spotify-Anmeldung abgelaufen — bitte erneut mit Spotify verbinden.";
  }

  if (status === 403) {
    if (normalizedBody.includes("premium") || normalizedBody.includes("subscription")) {
      return "Spotify Premium ist erforderlich — Wiedergabesteuerung ist nur mit Premium möglich.";
    }
    return "Keine Berechtigung für Spotify-Wiedergabe — bitte erneut verbinden (Scope user-modify-playback-state).";
  }

  if (status === 404) {
    if (
      normalizedBody.includes("device") ||
      normalizedBody.includes("no active device") ||
      normalizedBody.includes("player is offline")
    ) {
      return "Kein aktives Spotify-Gerät — Spotify-App oder Webplayer öffnen und Wiedergabe starten.";
    }
    return "Spotify-Wiedergabegerät nicht gefunden — Spotify Connect aktivieren.";
  }

  if (status === 429) {
    return "Spotify-Anfragelimit erreicht — bitte kurz warten und erneut versuchen.";
  }

  if (status >= 500) {
    return "Spotify-Server vorübergehend nicht erreichbar — bitte später erneut versuchen.";
  }

  return `Spotify-Wiedergabe fehlgeschlagen (HTTP ${status}).`;
}

function buildPlayBody(parsed: ParsedSpotifyUrl): Record<string, unknown> {
  if (parsed.type === "track") {
    return { uris: [parsed.uri] };
  }

  return { context_uri: parsed.uri };
}

function missingTokenResult(): SpotifyPlaybackResult {
  return {
    ok: false,
    message: "Spotify nicht verbunden — bitte zuerst mit Spotify anmelden (Premium erforderlich).",
  };
}

function invalidUriResult(): SpotifyPlaybackResult {
  return { ok: false, message: "Ungültige Spotify-URL oder URI." };
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export async function spotifyApiRequest(
  options: SpotifyApiClientOptions,
  method: string,
  path: string,
  init?: { body?: unknown; searchParams?: Record<string, string> },
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = new URL(`${SPOTIFY_API_BASE}${path}`);

  if (init?.searchParams) {
    for (const [key, value] of Object.entries(init.searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetchImpl(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (response.ok || response.status === 204) {
    return { ok: true };
  }

  const bodyText = await readResponseBody(response);
  return {
    ok: false,
    status: response.status,
    message: mapSpotifyHttpError(response.status, bodyText),
  };
}

export async function playSpotifyTrack(
  config: SpotifyPlaybackConfig,
  fetchImpl?: SpotifyFetch,
): Promise<SpotifyPlaybackResult> {
  if (!config.accessToken) {
    return missingTokenResult();
  }

  const parsed = parseSpotifyUrl(config.uri);
  if (!parsed) {
    return invalidUriResult();
  }

  const volumePercent =
    config.volume !== undefined ? mapButtonVolumeToSpotifyPercent(config.volume) : undefined;

  const result = await spotifyApiRequest(
    { accessToken: config.accessToken, fetchImpl },
    "PUT",
    "/me/player/play",
    {
      body: buildPlayBody(parsed),
      searchParams: volumePercent !== undefined ? { volume_percent: String(volumePercent) } : undefined,
    },
  );

  if (!result.ok) {
    return { ok: false, message: result.message, status: result.status };
  }

  return { ok: true, message: "Spotify-Wiedergabe gestartet." };
}

export async function pauseSpotifyPlayback(
  config: SpotifyTokenConfig,
  fetchImpl?: SpotifyFetch,
): Promise<SpotifyPlaybackResult> {
  if (!config.accessToken) {
    return missingTokenResult();
  }

  const result = await spotifyApiRequest(
    { accessToken: config.accessToken, fetchImpl },
    "PUT",
    "/me/player/pause",
  );

  if (!result.ok) {
    return { ok: false, message: result.message, status: result.status };
  }

  return { ok: true, message: "Spotify-Wiedergabe pausiert." };
}

export async function resumeSpotifyPlayback(
  config: SpotifyTokenConfig,
  fetchImpl?: SpotifyFetch,
): Promise<SpotifyPlaybackResult> {
  if (!config.accessToken) {
    return missingTokenResult();
  }

  const result = await spotifyApiRequest(
    { accessToken: config.accessToken, fetchImpl },
    "PUT",
    "/me/player/play",
  );

  if (!result.ok) {
    return { ok: false, message: result.message, status: result.status };
  }

  return { ok: true, message: "Spotify-Wiedergabe fortgesetzt." };
}

/** Spotify has no explicit stop endpoint — pause is the closest equivalent. */
export async function stopSpotifyPlayback(
  config: SpotifyTokenConfig,
  fetchImpl?: SpotifyFetch,
): Promise<SpotifyPlaybackResult> {
  return pauseSpotifyPlayback(config, fetchImpl);
}

export async function setSpotifyVolume(
  config: SpotifyVolumeConfig,
  fetchImpl?: SpotifyFetch,
): Promise<SpotifyPlaybackResult> {
  if (!config.accessToken) {
    return missingTokenResult();
  }

  const volumePercent = mapButtonVolumeToSpotifyPercent(config.volume);
  const result = await spotifyApiRequest(
    { accessToken: config.accessToken, fetchImpl },
    "PUT",
    "/me/player/volume",
    {
      searchParams: { volume_percent: String(volumePercent) },
    },
  );

  if (!result.ok) {
    return { ok: false, message: result.message, status: result.status };
  }

  return { ok: true, message: "Spotify-Lautstärke angepasst." };
}
