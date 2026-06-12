import { NextResponse } from "next/server";
import { setSpotifyVolume } from "@uwe/soundboard";
import { requireStudioApiAuth } from "../../../../src/lib/studio-api-auth";
import { getValidSpotifyAccessToken } from "../../../../src/lib/spotify-auth";

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  let body: { volume?: number };
  try {
    body = (await request.json()) as { volume?: number };
  } catch {
    return NextResponse.json({ ok: false, message: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (typeof body.volume !== "number" || Number.isNaN(body.volume)) {
    return NextResponse.json(
      { ok: false, message: "Lautstärke fehlt oder ist ungültig." },
      { status: 400 },
    );
  }

  const accessToken = await getValidSpotifyAccessToken();
  const result = await setSpotifyVolume({ accessToken, volume: body.volume });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
