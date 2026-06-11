import fs from "node:fs";
import { NextResponse } from "next/server";
import {
  buildStorageKey,
  ensureUploadDirectory,
  inferAssetTypeFromMime,
  inferMimeTypeFromFilename,
  resolveAssetFilePath,
} from "@uwe/assets";
import {
  getAppRepository,
  getSystemSettings,
  resolveEffectiveUploadsPath,
  type AssetType,
  type Visibility,
} from "@uwe/database/server";

interface RouteContext {
  params: Promise<{ worldSlug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { worldSlug } = await context.params;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);

  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File required" }, { status: 400 });
  }

  const title = String(formData.get("title") || file.name || "Unbenannt");
  const description = String(formData.get("description") || "") || null;
  const visibility = (String(formData.get("visibility") || "dm_only") as Visibility) ?? "dm_only";
  const pageId = String(formData.get("pageId") || "") || null;

  const mimeType = file.type || inferMimeTypeFromFilename(file.name);
  const type =
    (String(formData.get("type") || "") as AssetType) ||
    inferAssetTypeFromMime(mimeType);

  const storageKey = buildStorageKey(world.id, file.name);
  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);
  ensureUploadDirectory(world.id, undefined, uploadsRoot);
  const filePath = resolveAssetFilePath(storageKey, undefined, uploadsRoot);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const asset = await repo.createAsset({
    worldId: world.id,
    title,
    description,
    type,
    storageKey,
    mimeType,
    size: file.size,
    visibility,
  });

  if (pageId) {
    await repo.linkAssetToPage(asset.id, pageId);
  }

  const redirectUrl = new URL(`/worlds/${worldSlug}/assets?uploaded=1`, request.url);
  const accept = request.headers.get("accept") ?? "";

  if (accept.includes("application/json")) {
    return NextResponse.json({
      id: asset.id,
      title: asset.title,
      type: asset.type,
      storageKey: asset.storageKey,
    });
  }

  return NextResponse.redirect(redirectUrl);
}
