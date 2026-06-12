import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";
import { stopSpotifyForWorld } from "@/src/lib/spotify-handlers";

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { worldSlug } = await params;
  return stopSpotifyForWorld(worldSlug);
}
