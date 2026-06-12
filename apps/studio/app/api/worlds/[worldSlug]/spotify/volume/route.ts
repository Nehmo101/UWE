import { NextResponse } from "next/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";
import { setSpotifyVolumeForWorld } from "@/src/lib/spotify-handlers";

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { worldSlug } = await params;

  let body: { volume?: number };

  try {
    body = (await request.json()) as { volume?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  return setSpotifyVolumeForWorld(worldSlug, body);
}
