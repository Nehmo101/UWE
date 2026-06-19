import fs from "node:fs";
import { NextResponse } from "next/server";
import {
  ensureUploadDirectory,
  resolveAssetFilePath,
  validateUploadInput,
} from "@uwe/assets";
import {
  CAPTURE_UPLOAD_NAMESPACE,
  getSystemSettings,
  resolveEffectiveUploadsPath,
} from "@uwe/database/server";
import { guardStudioMutation } from "@uwe/security";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "upload" });
  if (authError) return authError;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Datei erforderlich" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let validated;
  try {
    validated = validateUploadInput({
      buffer,
      worldId: CAPTURE_UPLOAD_NAMESPACE,
      originalFilename: file.name,
      declaredMimeType: file.type || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload ungültig";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);
  ensureUploadDirectory(CAPTURE_UPLOAD_NAMESPACE, undefined, uploadsRoot);
  const filePath = resolveAssetFilePath(validated.storageKey, undefined, uploadsRoot);
  fs.writeFileSync(filePath, validated.buffer);

  return NextResponse.json({
    storageKey: validated.storageKey,
    mimeType: validated.mimeType,
    size: validated.size,
    originalFilename: validated.originalFilename,
  });
}
