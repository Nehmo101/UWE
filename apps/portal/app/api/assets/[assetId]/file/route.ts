import fs from "node:fs";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import { NextResponse } from "next/server";
import { resolveAssetFilePath, requiresSignedMediaAccess, verifySignedMediaToken } from "@uwe/assets";
import {
  createAuthService,
  createPrismaClient,
  getSystemSettings,
  isPortalGloballyEnabled,
} from "@uwe/database/server";
import { assertCanReadWorldWithContext } from "@uwe/auth";
import { getAccessContextForWorld, getSessionToken } from "@/src/lib/auth";

interface RouteContext {
  params: Promise<{ assetId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

  const settings = await getSystemSettings();
  if (!isPortalGloballyEnabled(settings)) {
    return NextResponse.json({ error: "Portal disabled" }, { status: 403 });
  }

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
  if (!token && ctx.effectiveRole !== "guest") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createPrismaClient();
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

    if (requiresSignedMediaAccess(asset.visibility)) {
      const signature = new URL(request.url).searchParams.get("sig");
      if (
        !signature ||
        !verifySignedMediaToken(signature, { assetId: asset.id, worldSlug })
      ) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
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

    const data = fs.readFileSync(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": asset.mimeType ?? "application/octet-stream",
        "Content-Length": String(asset.size),
        "Content-Disposition": `inline; filename="${encodeURIComponent(asset.title)}"`,
      },
    });
  } finally {
    await db.$disconnect();
  }
}
