import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { parseParams, worldSlugParamSchema } from "@uwe/security";
import { getSpotifyStatus } from "@/src/lib/spotify-handlers";

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsedParams = await parseParams(params, worldSlugParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  return getSpotifyStatus(parsedParams.data.worldSlug);
}
