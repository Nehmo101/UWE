import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeSpotifyAuthorizationCode,
  sanitizeSpotifyReturnPath,
} from "../../../../src/lib/spotify-auth";

const STATE_COOKIE = "uwe_spotify_oauth_state";
const RETURN_COOKIE = "uwe_spotify_oauth_return";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const returnTo = sanitizeSpotifyReturnPath(cookieStore.get(RETURN_COOKIE)?.value);
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;

  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(RETURN_COOKIE);

  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      `${returnTo}?spotifyError=${encodeURIComponent(`Spotify-Anmeldung abgebrochen: ${error}`)}`,
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      `${returnTo}?spotifyError=${encodeURIComponent("Ungültiger Spotify-OAuth-Status — bitte erneut versuchen.")}`,
    );
  }

  try {
    await exchangeSpotifyAuthorizationCode(code);
    return NextResponse.redirect(`${returnTo}?spotifyConnected=1`);
  } catch (exchangeError) {
    const message =
      exchangeError instanceof Error
        ? exchangeError.message
        : "Spotify-Verbindung fehlgeschlagen.";
    return NextResponse.redirect(`${returnTo}?spotifyError=${encodeURIComponent(message)}`);
  }
}
