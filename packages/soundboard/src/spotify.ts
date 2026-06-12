/**
 * Spotify playback adapter (prepared for future integration).
 *
 * Full playback control requires Spotify Premium and the Spotify Web API /
 * Spotify Connect. OAuth and token refresh are intentionally not implemented yet.
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
  /** OAuth access token — to be supplied after future auth flow */
  accessToken?: string | null;
  /** Spotify URI or track/album/playlist URL */
  uri: string;
  volume?: number;
}

export interface SpotifyPlaybackResult {
  ok: boolean;
  message: string;
}

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

/** Placeholder until OAuth + Web API playback is wired up. */
export async function playSpotifyTrack(
  config: SpotifyPlaybackConfig,
): Promise<SpotifyPlaybackResult> {
  if (!config.accessToken) {
    return {
      ok: false,
      message:
        "Spotify playback requires Premium and API authentication (OAuth not implemented yet).",
    };
  }

  const uri = normalizeSpotifyUri(config.uri);
  if (!uri) {
    return { ok: false, message: "Invalid Spotify URL or URI." };
  }

  return {
    ok: false,
    message:
      "Spotify Web API playback adapter is prepared but not connected. Implement OAuth and PUT /v1/me/player/play.",
  };
}
