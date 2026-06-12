import { NextResponse } from "next/server";
import { playSpotifyTrack } from "@uwe/soundboard";
import { requireStudioApiAuth } from "../../../../src/lib/studio-api-auth";
import { getValidSpotifyAccessToken } from "../../../../src/lib/spotify-auth";

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  let body: { uri?: string; volume?: number };
  try {
    body = (await request.json()) as { uri?: string; volume?: number };
  } catch {
    return NextResponse.json({ ok: false, message: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!body.uri?.trim()) {
    return NextResponse.json(
      { ok: false, message: "Spotify-URI fehlt." },
      { status: 400 },
    );
  }

  const accessToken = await getValidSpotifyAccessToken();
  const result = await playSpotifyTrack({
    accessToken,
    uri: body.uri,
    volume: body.volume,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
