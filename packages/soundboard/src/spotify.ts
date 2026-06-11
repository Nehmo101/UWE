/**
 * Spotify playback adapter (prepared for future integration).
 *
 * Full playback control requires Spotify Premium and the Spotify Web API /
 * Spotify Connect. OAuth and token refresh are intentionally not implemented yet.
 *
 * @see https://developer.spotify.com/documentation/web-api
 */

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

export function isSpotifyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("spotify.com") || parsed.protocol === "spotify:";
  } catch {
    return url.startsWith("spotify:");
  }
}

export function normalizeSpotifyUri(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("spotify:")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname.includes("spotify.com")) {
      return null;
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return null;
    }

    const [type, id] = parts.slice(-2);
    if (!type || !id) {
      return null;
    }

    return `spotify:${type}:${id}`;
  } catch {
    return null;
  }
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
