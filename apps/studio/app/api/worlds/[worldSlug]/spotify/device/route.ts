import { z } from "zod";
import { parseParams, worldSlugParamSchema } from "@uwe/security";
import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { setPreferredSpotifyDevice } from "@/src/lib/spotify-handlers";

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

const setDeviceSchema = z.object({
  deviceId: z.string().nullable(),
  deviceName: z.string().nullable(),
});

export async function POST(request: Request, { params }: RouteParams) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const parsedParams = await parseParams(params, worldSlugParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const parsed = setDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  return setPreferredSpotifyDevice(parsedParams.data.worldSlug, parsed.data);
}
