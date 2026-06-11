import fs from "node:fs";
import { NextResponse } from "next/server";
import { resolveAssetFilePath } from "@uwe/assets";
import {
  createPrismaClient,
  createShareLinkService,
  getSystemSettings,
  isPublicSharingEnabled,
  isShareLinkActive,
} from "@uwe/database/server";
import { isSharePasswordVerified } from "@/src/lib/share-auth";

interface RouteContext {
  params: Promise<{ token: string; assetId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { token, assetId } = await context.params;
  const db = createPrismaClient();
  const shareService = createShareLinkService(db);

  try {
    const settings = await getSystemSettings();
    if (!isPublicSharingEnabled(settings)) {
      return NextResponse.json({ error: "Sharing disabled" }, { status: 403 });
    }

    const link = await shareService.getShareLinkByToken(token);
    if (!link || !isShareLinkActive(link)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (link.passwordHash) {
      const passwordVerified = await isSharePasswordVerified(token);
      if (!passwordVerified) {
        return NextResponse.json({ error: "Password required" }, { status: 401 });
      }
    }

    const grant = await shareService.buildShareGrantForWorld(link.worldId);
    if (!shareService.canAccessAssetViaShare(assetId, grant)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const asset = await db.asset.findUnique({ where: { id: assetId } });
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
