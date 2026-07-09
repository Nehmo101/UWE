import { NextResponse } from "next/server";
import { getAppRepository } from "@uwe/database/server";
import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { slugSchema, parseQuery } from "@uwe/security";
import { z } from "zod";

const querySchema = z.object({
  slug: slugSchema,
});

interface RouteParams {
  params: Promise<{ worldSlug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const { worldSlug } = await params;
  const parsed = parseQuery(request.url, querySchema);
  if (!parsed.success) return parsed.response;

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    return NextResponse.json({ available: false, error: "Welt nicht gefunden." }, { status: 404 });
  }

  const existing = await repo.getPageBySlug(worldSlug, parsed.data.slug);
  return NextResponse.json({ available: !existing });
}
