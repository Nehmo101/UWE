import { NextResponse } from "next/server";
import { getSpotifyConnectionStatus } from "../../../../src/lib/spotify-auth";

export async function GET() {
  const status = await getSpotifyConnectionStatus();
  return NextResponse.json({ status });
}
