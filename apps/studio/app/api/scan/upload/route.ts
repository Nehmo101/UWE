import fs from "node:fs";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  ensureUploadDirectory,
  resolveAssetFilePath,
  validateUploadInput,
  UploadValidationError,
} from "@uwe/assets";
import {
  getSystemSettings,
  prisma,
  resolveEffectiveUploadsPath,
} from "@uwe/database/server";
import { createScanInboxService, type ScanPrivacyLevel } from "@uwe/scan-inbox";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";

/** Storage namespace for world-independent scan uploads (Studio-only). */
const SCAN_UPLOAD_NAMESPACE = "_scan";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "upload" });
  if (authError) return authError;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError("Datei erforderlich.", 400);
  }

  const title = String(formData.get("title") ?? "").trim() || file.name || "Scan";
  const privacyRaw = String(formData.get("privacyLevel") ?? "private");
  const privacyLevel: ScanPrivacyLevel = privacyRaw === "dnd" ? "dnd" : "private";

  const buffer = Buffer.from(await file.arrayBuffer());
  const settings = await getSystemSettings(prisma);
  const uploadsRoot = resolveEffectiveUploadsPath(settings);

  let storageKey: string;
  let mimeType: string;
  try {
    const validated = validateUploadInput({
      buffer,
      originalFilename: file.name,
      declaredMimeType: file.type,
      worldId: SCAN_UPLOAD_NAMESPACE,
    });
    storageKey = validated.storageKey;
    mimeType = validated.mimeType;
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return jsonError(error.message, 400);
    }
    throw error;
  }

  ensureUploadDirectory(SCAN_UPLOAD_NAMESPACE, undefined, uploadsRoot);
  const filePath = resolveAssetFilePath(storageKey, undefined, uploadsRoot);
  fs.writeFileSync(filePath, buffer);

  const scan = await createScanInboxService(prisma).create({
    storageKey,
    mimeType,
    fileSize: buffer.length,
    title,
    privacyLevel,
  });

  return NextResponse.json({ id: scan.id, title: scan.title });
}
