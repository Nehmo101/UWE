import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { inferMimeTypeFromFilename, UploadValidationError } from "@uwe/assets";
import {
  getAppRepository,
  prisma,
  storeUploadedAsset,
  type AssetType,
} from "@uwe/database/server";
import { getUweEnvOrNull } from "@uwe/env";
import { parseFormData, parseParams, uploadMetadataSchema, worldSlugParamSchema } from "@uwe/security";

interface RouteContext {
  params: Promise<{ worldSlug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const authError = await guardStudioApiRequest(request, { rateLimit: "upload" });
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
  const buffer = Buffer.from(await file.arrayBuffer());

  // Die Upload-Sequenz (validate → write → createAsset → audit) liegt in
  // storeUploadedAsset; hier bleiben Guard, Formular und Antwortformat.
  let asset;
  try {
    asset = await storeUploadedAsset(prisma, {
      worldId: world.id,
      buffer,
      title: metadata.title || file.name || "Unbenannt",
      description: metadata.description || null,
      type: (metadata.type as AssetType | undefined) || undefined,
      validate: {
        originalFilename: file.name,
        declaredMimeType: file.type || inferMimeTypeFromFilename(file.name),
      },
      audit: {
        type: metadata.type ?? null,
        mimeType: file.type || null,
        size: buffer.length,
      },
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return jsonError(error.message, 400);
    }
    throw error;
  }

  if (metadata.pageId) {
    await repo.linkAssetToPage(asset.id, metadata.pageId);
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
