import fs from "node:fs";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  ensureUploadDirectory,
  inferAssetTypeFromMime,
  inferMimeTypeFromFilename,
  resolveAssetFilePath,
  validateUploadInput,
  UploadValidationError,
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
import { parseFormData, parseParams, uploadMetadataSchema, worldSlugParamSchema } from "@uwe/security";

interface RouteContext {
  params: Promise<{ worldSlug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "upload" });
  if (authError) return authError;

  const parsedParams = await parseParams(context.params, worldSlugParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const { worldSlug } = parsedParams.data;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);

  if (!world) {
    return jsonError("World not found", 404);
  }

  const formData = await request.formData();
  const parsedMetadata = parseFormData(formData, uploadMetadataSchema);
  if (!parsedMetadata.success) return parsedMetadata.response;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError("File required", 400);
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
  const pageId = metadata.pageId ?? null;

  const mimeType = file.type || inferMimeTypeFromFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  let validated;
  try {
    validated = validateUploadInput({
      buffer,
      originalFilename: file.name,
      declaredMimeType: mimeType,
      worldId: world.id,
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return jsonError(error.message, 400);
    }
    throw error;
  }

  const type =
    (metadata.type as AssetType | undefined) || inferAssetTypeFromMime(validated.mimeType);

  const storageKey = validated.storageKey;
  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);
  ensureUploadDirectory(world.id, undefined, uploadsRoot);
  const filePath = resolveAssetFilePath(storageKey, undefined, uploadsRoot);
  await fs.promises.writeFile(filePath, buffer);

  const asset = await repo.createAsset({
    worldId: world.id,
    title,
    description,
    type,
    storageKey,
    mimeType: validated.mimeType,
    size: buffer.length,
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
