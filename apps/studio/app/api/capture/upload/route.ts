import fs from "node:fs";
import { NextResponse } from "next/server";
import {
  ensureUploadDirectory,
  inferAssetTypeFromMime,
  resolveAssetFilePath,
  validateUploadInput,
  UploadValidationError,
} from "@uwe/assets";
import {
  createLifeAdminService,
  getAppRepository,
  getSystemSettings,
  linkAssetToTarget,
  logAuditEvent,
  prisma,
  resolveEffectiveUploadsPath,
} from "@uwe/database/server";
import { guardStudioMutation } from "@uwe/security";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "upload" });
  if (authError) return authError;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Datei erforderlich." }, { status: 400 });
  }

  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || file.name || "Capture Bild";
  const content = String(formData.get("content") ?? "").trim();
  const captureType = String(formData.get("captureType") ?? "file_image");

  const repo = getAppRepository();
  const world = worldSlug ? await repo.getWorldBySlug(worldSlug) : null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);

  let storageKey: string;
  let mimeType: string;

  try {
    const validated = validateUploadInput({
      buffer,
      originalFilename: file.name,
      declaredMimeType: file.type,
      worldId: world?.id ?? "capture",
    });
    storageKey = validated.storageKey;
    mimeType = validated.mimeType;
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const uploadWorldId = world?.id ?? "capture";
  ensureUploadDirectory(uploadWorldId, undefined, uploadsRoot);
  const filePath = resolveAssetFilePath(storageKey, undefined, uploadsRoot);
  fs.writeFileSync(filePath, buffer);

  const lifeAdmin = createLifeAdminService(prisma);
  const capture = await lifeAdmin.createCapture({
    title,
    content: content || `Bild-Upload: ${title}`,
    captureType: captureType === "file_image" ? "file_image" : "quick_note",
    storageKey,
    worldId: world?.id ?? null,
    status: "inbox",
    metadata: { mimeType, size: buffer.length, source: "mobile_capture" },
  });

  let assetId: string | null = null;

  if (world) {
    const asset = await repo.createAsset({
      worldId: world.id,
      title,
      type: inferAssetTypeFromMime(mimeType),
      storageKey,
      mimeType,
      size: buffer.length,
      visibility: "dm_only",
      metadata: { source: "capture", captureId: capture.id },
    });
    assetId = asset.id;

    await linkAssetToTarget(prisma, {
      assetId: asset.id,
      targetType: "capture",
      targetId: capture.id,
      relationType: "uploaded_from",
    });

    await logAuditEvent(prisma, {
      action: "upload_created",
      targetType: "asset",
      targetId: asset.id,
      worldId: world.id,
      metadata: { title: asset.title, source: "capture_upload" },
    });
  }

  return NextResponse.json({
    captureId: capture.id,
    assetId,
    storageKey,
    title: capture.title,
  });
}
