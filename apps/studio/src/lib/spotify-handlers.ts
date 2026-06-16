import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createPrismaClient,
  createSpotifyConnectionService,
  isSpotifyOAuthConfigured,
  resolveSpotifyOAuthConfig,
} from "@uwe/database/server";
import {
  buildSpotifyAuthorizationUrl,
  exchangeSpotifyAuthorizationCode,
  pauseSpotifyPlayback,
  playSpotifyTrack,
  resumeSpotifyPlayback,
  setSpotifyVolume,
  stopSpotifyPlayback,
} from "@uwe/soundboard";
import {
  encodeOAuthState,
  hashStateCookieValue,
  SPOTIFY_STATE_COOKIE,
  verifySpotifyOAuthState,
} from "./spotify-oauth-state";
import { getOAuthStateCookieOptions } from "@uwe/auth";

const SPOTIFY_STATE_COOKIE_PATH = "/api/spotify/callback";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getSpotifyService() {
  const oauthConfig = resolveSpotifyOAuthConfig();
  if (!oauthConfig) {
    return null;
  }

  const db = createPrismaClient();
  return {
    db,
    oauthConfig,
    service: createSpotifyConnectionService(db, oauthConfig),
  };
}

function encodeOAuthStateForRequest(state: { worldSlug: string; nonce: string }): string {
  return encodeOAuthState(state);
}

export async function getSpotifyStatus(worldSlug: string) {
  const runtime = getSpotifyService();
  if (!runtime) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message: "Spotify OAuth ist nicht konfiguriert (SPOTIFY_CLIENT_ID/SECRET).",
    });
  }

  try {
    const status = await runtime.service.getStatusByWorldSlug(worldSlug);
    return NextResponse.json({
      configured: true,
      ...status,
    });
  } finally {
    await runtime.db.$disconnect();
  }
}

export async function startSpotifyConnect(worldSlug: string) {
  const runtime = getSpotifyService();
  if (!runtime) {
    return jsonError("Spotify OAuth ist nicht konfiguriert.", 503);
  }

  try {
    const world = await runtime.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });

    if (!world) {
      return jsonError("Welt nicht gefunden.", 404);
    }

    const nonce = randomBytes(16).toString("hex");
    const state = encodeOAuthStateForRequest({ worldSlug, nonce });
    const authorizationUrl = buildSpotifyAuthorizationUrl(runtime.oauthConfig, state);

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(SPOTIFY_STATE_COOKIE, hashStateCookieValue(nonce), {
      ...getOAuthStateCookieOptions(SPOTIFY_STATE_COOKIE_PATH),
      maxAge: 10 * 60,
    });

    return response;
  } finally {
    await runtime.db.$disconnect();
  }
}

export async function handleSpotifyCallback(request: Request) {
  const runtime = getSpotifyService();
  if (!runtime) {
    return jsonError("Spotify OAuth ist nicht konfiguriert.", 503);
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (error) {
    return redirectWithSpotifyMessage(error);
  }

  if (!code || !stateParam) {
    return redirectWithSpotifyMessage("Spotify-Callback unvollständig.");
  }

  const cookieStore = await cookies();
  const verified = verifySpotifyOAuthState(
    stateParam,
    cookieStore.get(SPOTIFY_STATE_COOKIE)?.value,
  );

  if (!verified.ok) {
    return redirectWithSpotifyMessage(verified.reason);
  }

  const state = verified.state;

  try {
    const tokenResult = await exchangeSpotifyAuthorizationCode(runtime.oauthConfig, code);
    if (!tokenResult.ok) {
      return redirectToSoundboard(state.worldSlug, tokenResult.error);
    }

    const profileResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${tokenResult.tokens.accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      return redirectToSoundboard(state.worldSlug, "Spotify-Profil konnte nicht geladen werden.");
    }

    const profile = (await profileResponse.json()) as {
      id?: string;
      display_name?: string | null;
    };

    if (!profile.id) {
      return redirectToSoundboard(state.worldSlug, "Spotify-Profil unvollständig.");
    }

    const world = await runtime.db.world.findUnique({
      where: { slug: state.worldSlug },
      select: { id: true },
    });

    if (!world) {
      return redirectToSoundboard(state.worldSlug, "Welt nicht gefunden.");
    }

    await runtime.service.saveConnection({
      worldId: world.id,
      spotifyUserId: profile.id,
      spotifyDisplayName: profile.display_name ?? null,
      tokens: tokenResult.tokens,
    });

    return redirectToSoundboard(state.worldSlug);
  } finally {
    await runtime.db.$disconnect();
  }
}

export async function disconnectSpotify(worldSlug: string) {
  const runtime = getSpotifyService();
  if (!runtime) {
    return jsonError("Spotify OAuth ist nicht konfiguriert.", 503);
  }

  try {
    const removed = await runtime.service.disconnectByWorldSlug(worldSlug);
    if (!removed) {
      return jsonError("Welt nicht gefunden.", 404);
    }

    return NextResponse.json({ ok: true });
  } finally {
    await runtime.db.$disconnect();
  }
}

export async function playSpotifyForWorld(
  worldSlug: string,
  body: { uri?: string; volume?: number },
) {
  if (!body.uri?.trim()) {
    return jsonError("Spotify-URI fehlt.");
  }

  const runtime = getSpotifyService();
  if (!runtime) {
    return jsonError("Spotify OAuth ist nicht konfiguriert.", 503);
  }

  try {
    const accessToken = await runtime.service.getValidAccessTokenByWorldSlug(worldSlug);
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, message: "Spotify ist für diese Welt nicht verbunden." },
        { status: 401 },
      );
    }

    const result = await playSpotifyTrack({
      accessToken,
      uri: body.uri,
      volume: body.volume,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } finally {
    await runtime.db.$disconnect();
  }
}

async function withWorldAccessToken(
  worldSlug: string,
  action: (accessToken: string) => Promise<{ ok: boolean; message: string; status?: number }>,
) {
  const runtime = getSpotifyService();
  if (!runtime) {
    return jsonError("Spotify OAuth ist nicht konfiguriert.", 503);
  }

  try {
    const accessToken = await runtime.service.getValidAccessTokenByWorldSlug(worldSlug);
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, message: "Spotify ist für diese Welt nicht verbunden." },
        { status: 401 },
      );
    }

    const result = await action(accessToken);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } finally {
    await runtime.db.$disconnect();
  }
}

export async function pauseSpotifyForWorld(worldSlug: string) {
  return withWorldAccessToken(worldSlug, (accessToken) =>
    pauseSpotifyPlayback({ accessToken }),
  );
}

export async function resumeSpotifyForWorld(worldSlug: string) {
  return withWorldAccessToken(worldSlug, (accessToken) =>
    resumeSpotifyPlayback({ accessToken }),
  );
}

export async function stopSpotifyForWorld(worldSlug: string) {
  return withWorldAccessToken(worldSlug, (accessToken) =>
    stopSpotifyPlayback({ accessToken }),
  );
}

export async function setSpotifyVolumeForWorld(
  worldSlug: string,
  body: { volume?: number },
) {
  if (typeof body.volume !== "number") {
    return jsonError("Lautstärke fehlt.");
  }

  return withWorldAccessToken(worldSlug, (accessToken) =>
    setSpotifyVolume({ accessToken, volume: body.volume as number }),
  );
}

export function getSpotifyConfigurationSummary() {
  return {
    configured: isSpotifyOAuthConfigured(),
    redirectUri: resolveSpotifyOAuthConfig()?.redirectUri ?? null,
  };
}

function redirectToSoundboard(worldSlug: string, errorMessage?: string): NextResponse {
  const studioUrl = process.env.NEXT_PUBLIC_STUDIO_URL?.replace(/\/$/, "") ?? "";
  const params = new URLSearchParams();

  if (errorMessage) {
    params.set("spotifyError", errorMessage);
  } else {
    params.set("spotifyConnected", "1");
  }

  const response = NextResponse.redirect(
    `${studioUrl}/worlds/${encodeURIComponent(worldSlug)}/soundboard?${params.toString()}`,
  );
  clearSpotifyStateCookie(response);
  return response;
}

function redirectWithSpotifyMessage(errorMessage: string): NextResponse {
  const studioUrl = process.env.NEXT_PUBLIC_STUDIO_URL?.replace(/\/$/, "") ?? "";
  const params = new URLSearchParams({ spotifyError: errorMessage });
  const response = NextResponse.redirect(`${studioUrl}/?${params.toString()}`);
  clearSpotifyStateCookie(response);
  return response;
}

function clearSpotifyStateCookie(response: NextResponse) {
  response.cookies.set(SPOTIFY_STATE_COOKIE, "", {
    ...getOAuthStateCookieOptions(SPOTIFY_STATE_COOKIE_PATH),
    maxAge: 0,
  });
}
