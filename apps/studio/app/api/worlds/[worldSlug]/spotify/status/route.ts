import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";
import { getSpotifyStatus } from "@/src/lib/spotify-handlers";

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { worldSlug } = await params;
  return getSpotifyStatus(worldSlug);
}
