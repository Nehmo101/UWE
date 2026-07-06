import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";
import {
  parseBody,
  parseParams,
  worldSlugParamSchema,
} from "@uwe/security";
import { setSpotifyVolumeForWorld } from "@/src/lib/spotify-handlers";
import { z } from "zod";

const spotifyVolumeBodySchema = z.object({
  volume: z.number().min(0).max(100).optional(),
});

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const parsedParams = await parseParams(params, worldSlugParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, spotifyVolumeBodySchema);
  if (!parsed.success) return parsed.response;

  return setSpotifyVolumeForWorld(parsedParams.data.worldSlug, parsed.data);
}
