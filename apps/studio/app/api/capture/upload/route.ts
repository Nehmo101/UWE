import fs from "node:fs";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
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
  saveCaptureUploadFile,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";

const ATTACHMENT_CAPTURE_TYPES = new Set(["file_image", "voice_memo"]);

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "upload" });
  if (authError) return authError;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError("Datei erforderlich.", 400);
  }

  const uploadOnly = formData.get("uploadOnly") === "1";
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || file.name || "Capture Anhang";
  const content = String(formData.get("content") ?? "").trim();
  const captureTypeRaw = String(formData.get("captureType") ?? "file_image");
  const captureType = ATTACHMENT_CAPTURE_TYPES.has(captureTypeRaw) ? captureTypeRaw : "file_image";

  const buffer = Buffer.from(await file.arrayBuffer());
  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);

  if (uploadOnly) {
    try {
      const validated = saveCaptureUploadFile(buffer, {
        originalFilename: file.name,
        declaredMimeType: file.type,
        uploadsRoot,
        imagesOnly: captureType === "file_image",
        audioOnly: captureType === "voice_memo",
      });
      return NextResponse.json({
        storageKey: validated.storageKey,
        originalFilename: file.name,
        mimeType: validated.mimeType,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload fehlgeschlagen.";
      return jsonError(message, 400);
    }
  }

  const repo = getAppRepository();
  const world = worldSlug ? await repo.getWorldBySlug(worldSlug) : null;

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
      return jsonError(error.message, 400);
    }
    throw error;
  }

  const uploadWorldId = world?.id ?? "capture";
  ensureUploadDirectory(uploadWorldId, undefined, uploadsRoot);
  const filePath = resolveAssetFilePath(storageKey, undefined, uploadsRoot);
  await fs.promises.writeFile(filePath, buffer);

  const lifeAdmin = createLifeAdminService(brainPrisma, prisma);
  const defaultContent =
    captureType === "voice_memo" ? `Sprachmemo: ${title}` : `Bild-Upload: ${title}`;
  const capture = await lifeAdmin.createCapture({
    title,
    content: content || defaultContent,
    captureType: captureType as "file_image" | "voice_memo",
    storageKey,
    worldId: world?.id ?? null,
    status: "inbox",
    metadata: {
      mimeType,
      size: buffer.length,
      source: "mobile_capture",
      originalFilename: file.name,
    },
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
      metadata: { source: "capture", captureId: capture.id },
    });
    assetId = asset.id;

    await linkAssetToTarget(prisma, brainPrisma, {
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
