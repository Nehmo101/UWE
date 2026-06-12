import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildSpotifyAuthorizeUrl,
  createSpotifyOAuthState,
  sanitizeSpotifyReturnPath,
} from "../../../../src/lib/spotify-auth";

const STATE_COOKIE = "uwe_spotify_oauth_state";
const RETURN_COOKIE = "uwe_spotify_oauth_return";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = sanitizeSpotifyReturnPath(url.searchParams.get("returnTo"));

  try {
    const state = createSpotifyOAuthState();
    const authorizeUrl = buildSpotifyAuthorizeUrl(state);
    const cookieStore = await cookies();

    cookieStore.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });

    cookieStore.set(RETURN_COOKIE, returnTo, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spotify OAuth fehlgeschlagen.";
    return NextResponse.redirect(`${returnTo}?spotifyError=${encodeURIComponent(message)}`);
  }
}
