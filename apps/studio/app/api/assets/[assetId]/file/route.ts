import fs from "node:fs";
import { NextResponse } from "next/server";
import { resolveAssetFilePath } from "@uwe/assets";
import { getAppRepository } from "@uwe/database/server";

interface RouteContext {
  params: Promise<{ assetId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { assetId } = await context.params;
  const repo = getAppRepository();
  const asset = await repo.getAssetById(assetId);

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
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
}
