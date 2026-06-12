import { NextResponse } from "next/server";
import { pauseSpotifyPlayback } from "@uwe/soundboard";
import { requireStudioApiAuth } from "../../../../src/lib/studio-api-auth";
import { getValidSpotifyAccessToken } from "../../../../src/lib/spotify-auth";

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const accessToken = await getValidSpotifyAccessToken();
  const result = await pauseSpotifyPlayback({ accessToken });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
