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
  logAuditEvent,
  prisma,
  resolveEffectiveUploadsPath,
  type AssetType,
} from "@uwe/database/server";
import { getUweEnvOrNull } from "@uwe/env";
import {
  guardStudioMutation,
  parseFormData,
  parseParams,
  uploadMetadataSchema,
  worldSlugParamSchema,
} from "@uwe/security";

interface RouteContext {
  params: Promise<{ worldSlug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const authError = guardStudioMutation(request, { rateLimit: "upload" });
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, worldSlugParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const { worldSlug } = parsedParams.data;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);

  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const parsedMetadata = parseFormData(formData, uploadMetadataSchema);
  if (!parsedMetadata.success) return parsedMetadata.response;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File required" }, { status: 400 });
  }

  const maxUploadBytes = getUweEnvOrNull()?.maxUploadBytes ?? 50 * 1024 * 1024;
  if (file.size > maxUploadBytes) {
    return NextResponse.json(
      {
        error: `File exceeds maximum upload size (${Math.floor(maxUploadBytes / (1024 * 1024))} MB)`,
      },
      { status: 413 },
    );
  }

  const metadata = parsedMetadata.data;
  const title = metadata.title || file.name || "Unbenannt";
  const description = metadata.description || null;
  const visibility = metadata.visibility;
  const pageId = metadata.pageId ?? null;

  const mimeType = file.type || inferMimeTypeFromFilename(file.name);
  const type =
    (metadata.type as AssetType | undefined) || inferAssetTypeFromMime(mimeType);

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

  await logAuditEvent(prisma, {
    action: "upload_created",
    targetType: "asset",
    targetId: asset.id,
    worldId: world.id,
    metadata: {
      title: asset.title,
      type: asset.type,
      mimeType: asset.mimeType,
      size: asset.size,
      visibility,
    },
  });

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
