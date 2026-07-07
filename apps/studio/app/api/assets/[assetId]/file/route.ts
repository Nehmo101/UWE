import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import fs from "node:fs";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { resolveAssetFilePath, buildAssetDownloadHeaders } from "@uwe/assets";
import { getAppRepository } from "@uwe/database/server";
import { assetIdParamSchema, parseParams } from "@uwe/security";

interface RouteContext {
  params: Promise<{ assetId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = await parseParams(context.params, assetIdParamSchema);
  if (!parsed.success) return parsed.response;

  const { assetId } = parsed.data;
  const repo = getAppRepository();
  const asset = await repo.getAssetById(assetId);

  if (!asset) {
    return jsonError("Asset not found", 404);
  }

  let filePath: string;
  try {
    filePath = resolveAssetFilePath(asset.storageKey);
  } catch {
    return jsonError("Invalid storage key", 400);
  }

  if (!fs.existsSync(filePath)) {
    return jsonError("File missing on disk", 404);
  }

  const data = fs.readFileSync(filePath);
  return new NextResponse(data, {
    // buildAssetDownloadHeaders serves non-image MIME types (svg/html) as a
    // sandboxed attachment with `Content-Security-Policy: default-src 'none';
    // sandbox` + nosniff, so a stored asset can never execute in this origin.
    headers: buildAssetDownloadHeaders({
      mimeType: asset.mimeType,
      size: asset.size,
      title: asset.title,
    }),
  });
}
