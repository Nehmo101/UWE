import { guardStudioMutation, parseParams, worldSlugParamSchema } from "@uwe/security";
import { disconnectSpotify } from "@/src/lib/spotify-handlers";

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const authError = guardStudioMutation(request);
  if (authError) return authError;

  const parsedParams = await parseParams(params, worldSlugParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  return disconnectSpotify(parsedParams.data.worldSlug);
}
