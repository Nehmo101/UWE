import fs from "node:fs";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import { NextResponse } from "next/server";
import { resolveAssetFilePath, buildAssetDownloadHeaders } from "@uwe/assets";
import { createAuthService } from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { assertCanReadWorldWithContext } from "@uwe/auth";
import { getAccessContextForWorld, getSessionToken } from "@/src/lib/auth";

interface RouteContext {
  params: Promise<{ assetId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  // Der globale Portal-Schalter steckt im Guard (requirePortalApiAuth).
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

  const { assetId } = await context.params;
  const worldSlug = new URL(request.url).searchParams.get("world");

  if (!worldSlug) {
    return NextResponse.json({ error: "world query parameter required" }, { status: 400 });
  }

  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getSessionToken();
  if (!token && ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSharedPrismaClient();
  const auth = createAuthService(db);

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
      assertCanReadWorldWithContext(ctx, world.id);
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const asset = await auth.getAssetForViewer(worldSlug, assetId, ctx);
    if (!asset) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let filePath: string;
    try {
      filePath = resolveAssetFilePath(asset.storageKey);
    } catch {
      return NextResponse.json({ error: "Invalid storage key" }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
    }

    const data = await fs.promises.readFile(filePath);
    return new NextResponse(data, {
      // Sandboxed, nosniff headers; non-image MIME types (svg/html) are served
      // as an attachment so a stored asset cannot execute in this origin.
      headers: buildAssetDownloadHeaders({
        mimeType: asset.mimeType,
        size: asset.size,
        title: asset.title,
      }),
    });
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
}
