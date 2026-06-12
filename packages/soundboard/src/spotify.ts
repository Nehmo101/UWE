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

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyCoverFetchOptions {
  /** User OAuth token — preferred when available (playback integration). */
  accessToken?: string | null;
  /** App credentials for Client Credentials flow (album covers, oEmbed fallback). */
  clientId?: string | null;
  clientSecret?: string | null;
  fetchImpl?: typeof fetch;
}

const SPOTIFY_OEMBED_ENDPOINT = "https://open.spotify.com/oembed";
const SPOTIFY_TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const COVER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedCover {
  url: string;
  expiresAt: number;
}

const coverCache = new Map<string, CachedCover>();
let cachedClientCredentialsToken: { token: string; expiresAt: number } | null = null;

function spotifyCoverCacheKey(parsed: ParsedSpotifyUrl): string {
  return `${parsed.type}:${parsed.id}`;
}

function toSpotifyWebUrl(parsed: ParsedSpotifyUrl): string {
  return `https://open.spotify.com/${parsed.type}/${parsed.id}`;
}

export function pickBestSpotifyImage(images: SpotifyImage[]): string | null {
  if (images.length === 0) {
    return null;
  }

  const sorted = [...images].sort((left, right) => (right.width ?? 0) - (left.width ?? 0));
  return sorted[0]?.url ?? null;
}

/** Returns a cached cover URL populated by {@link fetchSpotifyCoverUrl}. */
export function getCachedSpotifyCoverUrl(sourceUrl: string): string | null {
  const parsed = parseSpotifyUrl(sourceUrl);
  if (!parsed) {
    return null;
  }

  const cached = coverCache.get(spotifyCoverCacheKey(parsed));
  if (!cached || cached.expiresAt <= Date.now()) {
    return null;
  }

  return cached.url;
}

function rememberSpotifyCover(parsed: ParsedSpotifyUrl, url: string): void {
  coverCache.set(spotifyCoverCacheKey(parsed), {
    url,
    expiresAt: Date.now() + COVER_CACHE_TTL_MS,
  });
}

/** Clears in-memory cover and token caches (tests). */
export function clearSpotifyCoverCache(): void {
  coverCache.clear();
  cachedClientCredentialsToken = null;
}

export async function fetchSpotifyCoverViaOEmbed(
  sourceUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const parsed = parseSpotifyUrl(sourceUrl);
  if (!parsed || parsed.type === "album") {
    return null;
  }

  const webUrl = sourceUrl.trim().startsWith("spotify:")
    ? toSpotifyWebUrl(parsed)
    : sourceUrl.trim();
  const endpoint = `${SPOTIFY_OEMBED_ENDPOINT}?url=${encodeURIComponent(webUrl)}`;

  try {
    const response = await fetchImpl(endpoint);
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { thumbnail_url?: unknown };
    const thumbnail = payload.thumbnail_url;
    return typeof thumbnail === "string" && thumbnail.length > 0 ? thumbnail : null;
  } catch {
    return null;
  }
}

async function fetchSpotifyClientCredentialsToken(
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (
    cachedClientCredentialsToken &&
    cachedClientCredentialsToken.expiresAt > Date.now() + 30_000
  ) {
    return cachedClientCredentialsToken.token;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const response = await fetchImpl(SPOTIFY_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    const token = payload.access_token;
    const expiresIn = payload.expires_in;
    if (typeof token !== "string" || token.length === 0) {
      return null;
    }

    const ttlSeconds = typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : 3600;
    cachedClientCredentialsToken = {
      token,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
    return token;
  } catch {
    return null;
  }
}

async function resolveSpotifyAccessToken(
  options: SpotifyCoverFetchOptions | undefined,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  if (options?.accessToken?.trim()) {
    return options.accessToken.trim();
  }

  const clientId = options?.clientId?.trim();
  const clientSecret = options?.clientSecret?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }

  return fetchSpotifyClientCredentialsToken(clientId, clientSecret, fetchImpl);
}

function extractCoverFromWebApiPayload(
  type: SpotifyResourceType,
  payload: Record<string, unknown>,
): string | null {
  if (type === "track") {
    const album = payload.album;
    if (album && typeof album === "object" && !Array.isArray(album)) {
      const images = (album as Record<string, unknown>).images;
      if (Array.isArray(images)) {
        return pickBestSpotifyImage(images as SpotifyImage[]);
      }
    }
    return null;
  }

  const images = payload.images;
  if (Array.isArray(images)) {
    return pickBestSpotifyImage(images as SpotifyImage[]);
  }

  return null;
}

export async function fetchSpotifyCoverViaWebApi(
  parsed: ParsedSpotifyUrl,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const endpoint = `${SPOTIFY_API_BASE}/${parsed.type}s/${parsed.id}`;

  try {
    const response = await fetchImpl(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return extractCoverFromWebApiPayload(parsed.type, payload);
  } catch {
    return null;
  }
}

/**
 * Fetches a Spotify cover image URL via oEmbed (no auth) or Web API (Client Credentials / OAuth).
 * Results are cached in-memory for 24 hours.
 */
export async function fetchSpotifyCoverUrl(
  sourceUrl: string,
  options?: SpotifyCoverFetchOptions,
): Promise<string | null> {
  const parsed = parseSpotifyUrl(sourceUrl);
  if (!parsed) {
    return null;
  }

  const cached = coverCache.get(spotifyCoverCacheKey(parsed));
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const fetchImpl = options?.fetchImpl ?? fetch;

  const fromOEmbed = await fetchSpotifyCoverViaOEmbed(sourceUrl, fetchImpl);
  if (fromOEmbed) {
    rememberSpotifyCover(parsed, fromOEmbed);
    return fromOEmbed;
  }

  const accessToken = await resolveSpotifyAccessToken(options, fetchImpl);
  if (accessToken) {
    const fromApi = await fetchSpotifyCoverViaWebApi(parsed, accessToken, fetchImpl);
    if (fromApi) {
      rememberSpotifyCover(parsed, fromApi);
      return fromApi;
    }
  }

  return null;
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
