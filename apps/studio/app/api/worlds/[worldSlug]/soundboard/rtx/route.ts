import { z } from "zod";

import { guardStudioMutation, parseBody, parseParams, worldSlugParamSchema } from "@uwe/security";

import { dispatchSoundboardRtx } from "@/src/lib/soundboard-rtx";

const bodySchema = z.object({
  action: z.enum(["play", "stop", "stop_all", "volume"]),
  buttonId: z.string().max(64).optional(),
  sourceUrl: z.string().max(2000).optional(),
  title: z.string().max(200).optional(),
  volume: z.number().min(0).max(1).optional(),
});

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const authError = guardStudioMutation(request);
  if (authError) return authError;

  const parsedParams = await parseParams(params, worldSlugParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.success) return parsed.response;

  return dispatchSoundboardRtx(parsedParams.data.worldSlug, parsed.data);
}
