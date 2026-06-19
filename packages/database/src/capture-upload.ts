import fs from "node:fs";
import {
  ensureUploadDirectory,
  resolveAssetFilePath,
  validateUploadInput,
  type DetectedFileKind,
  type ValidatedUpload,
} from "@uwe/assets";

/** Storage namespace for world-independent capture uploads (Studio-only). */
export const CAPTURE_UPLOAD_NAMESPACE = "_capture";

const CAPTURE_IMAGE_KINDS: ReadonlySet<DetectedFileKind> = new Set([
  "png",
  "jpeg",
  "gif",
  "webp",
]);

export function saveCaptureUploadFile(
  buffer: Buffer,
  options: {
    originalFilename?: string | null;
    declaredMimeType?: string | null;
    uploadsRoot?: string;
    imagesOnly?: boolean;
  },
): ValidatedUpload {
  const validated = validateUploadInput({
    buffer,
    originalFilename: options.originalFilename,
    declaredMimeType: options.declaredMimeType,
    worldId: CAPTURE_UPLOAD_NAMESPACE,
  });

  if (options.imagesOnly && !CAPTURE_IMAGE_KINDS.has(validated.kind)) {
    throw new Error("Capture file_image accepts images only (PNG, JPEG, GIF, WebP).");
  }

  ensureUploadDirectory(CAPTURE_UPLOAD_NAMESPACE, undefined, options.uploadsRoot);
  const filePath = resolveAssetFilePath(validated.storageKey, undefined, options.uploadsRoot);
  fs.writeFileSync(filePath, validated.buffer);
  return validated;
}

export function resolveCaptureUploadFilePath(
  storageKey: string,
  uploadsRoot?: string,
): string {
  return resolveAssetFilePath(storageKey, undefined, uploadsRoot);
}
