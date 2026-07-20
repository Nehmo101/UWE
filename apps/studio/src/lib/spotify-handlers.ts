import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createPrismaClient,
  createSpotifyConnectionService,
  isSpotifyOAuthConfigured,
  resolveSpotifyOAuthConfig,
} from "@uwe/database/server";
import {
  exchangeSpotifyAuthorizationCode,
  listSpotifyDevices,
  pauseSpotifyPlayback,
  playSpotifyTrack,
  resumeSpotifyPlayback,
  setSpotifyVolume,
  stopSpotifyPlayback,
  transferSpotifyPlayback,
} from "@uwe/soundboard";
import {
  SPOTIFY_STATE_COOKIE,
  verifySpotifyOAuthState,
} from "./spotify-oauth-state";
import { getOAuthStateCookieOptions } from "@uwe/auth";
import { jsonError } from "./api-response";
import {
  isSpotifyConnectAvailable,
  tryDispatchSpotifyConnector,
} from "./spotify-connector";

const SPOTIFY_STATE_COOKIE_PATH = "/api/spotify/callback";

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

export async function getSpotifyStatus(worldSlug: string) {
  // Spotify auth now lives in the UWE Command Center. When a connector
  // advertises `spotify_connect`, report it as the active, connected backend.
  if (await isSpotifyConnectAvailable()) {
    return NextResponse.json({
      configured: true,
      connected: true,
      via: "rtx-connector",
      spotifyDisplayName: "RTX Connector",
      message: "RTX Connector",
    });
  }

  const runtime = getSpotifyService();
  if (!runtime) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message:
        "Spotify wird im UWE Command Center eingerichtet — dort Client-ID/Secret hinterlegen und anmelden.",
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

export async function startSpotifyConnect(_worldSlug: string) {
  // Host-side Spotify OAuth is retired. Spotify is connected exclusively in the
  // UWE Command Center (Spotify panel), which holds the OAuth credentials and
  // the active Spotify Connect device. Point the user there instead of starting
  // a host OAuth redirect.
  return NextResponse.json(
    {
      ok: false,
      setup: "rtx-connector-client",
      message:
        "Spotify wird jetzt im UWE Command Center eingerichtet: dort Client-ID/Secret hinterlegen, anmelden und das Ausgabegerät wählen.",
    },
    { status: 410 },
  );
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

  const queued = await tryDispatchSpotifyConnector(worldSlug, {
    action: "play",
    uri: body.uri,
    volume: body.volume,
  });
  if (queued) return queued;

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

    const preferredDeviceId = await runtime.service.getPreferredDeviceId(worldSlug);
    if (preferredDeviceId) {
      await transferSpotifyPlayback({ accessToken, deviceId: preferredDeviceId });
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

export async function listSpotifyDevicesForWorld(worldSlug: string) {
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

    const result = await listSpotifyDevices({ accessToken });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } finally {
    await runtime.db.$disconnect();
  }
}

export async function setPreferredSpotifyDevice(
  worldSlug: string,
  body: { deviceId: string | null; deviceName: string | null },
) {
  const runtime = getSpotifyService();
  if (!runtime) {
    return jsonError("Spotify OAuth ist nicht konfiguriert.", 503);
  }

  try {
    const updated = await runtime.service.setPreferredDevice(
      worldSlug,
      body.deviceId,
      body.deviceName,
    );

    if (!updated) {
      return jsonError("Welt oder Spotify-Verbindung nicht gefunden.", 404);
    }

    return NextResponse.json({ ok: true });
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
  const queued = await tryDispatchSpotifyConnector(worldSlug, { action: "pause" });
  if (queued) return queued;

  return withWorldAccessToken(worldSlug, (accessToken) =>
    pauseSpotifyPlayback({ accessToken }),
  );
}

export async function resumeSpotifyForWorld(worldSlug: string) {
  const queued = await tryDispatchSpotifyConnector(worldSlug, { action: "resume" });
  if (queued) return queued;

  return withWorldAccessToken(worldSlug, (accessToken) =>
    resumeSpotifyPlayback({ accessToken }),
  );
}

export async function stopSpotifyForWorld(worldSlug: string) {
  const queued = await tryDispatchSpotifyConnector(worldSlug, { action: "stop" });
  if (queued) return queued;

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

  const queued = await tryDispatchSpotifyConnector(worldSlug, {
    action: "volume",
    volume: body.volume,
  });
  if (queued) return queued;

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
