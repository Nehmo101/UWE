import fs from "node:fs";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import { NextResponse } from "next/server";
import { buildAssetDownloadHeaders, resolveAssetFilePath } from "@uwe/assets";
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

export async function GET(request: Request, context: RouteContext) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

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

    const grant = await shareService.buildShareGrantForLink(link);
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

    const data = await fs.promises.readFile(filePath);
    return new NextResponse(data, {
      headers: buildAssetDownloadHeaders({
        mimeType: asset.mimeType,
        size: data.length,
        title: asset.title,
        inline: true,
      }),
    });
  } finally {
    await db.$disconnect();
  }
}
