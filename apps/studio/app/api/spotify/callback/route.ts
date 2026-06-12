import { handleSpotifyCallback } from "@/src/lib/spotify-handlers";

export async function GET(request: Request) {
  return handleSpotifyCallback(request);
}
