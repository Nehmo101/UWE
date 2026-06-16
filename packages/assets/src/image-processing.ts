import fs from "node:fs";
import path from "node:path";
import { resolveAssetFilePath } from "./storage";
import { buildThumbnailStorageKey } from "./upload-policy";

export interface ProcessedImageResult {
  buffer: Buffer;
  mimeType: string;
  size: number;
  thumbnailStorageKey?: string;
  exifStripped: boolean;
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return fallback;
}

export function shouldStripExif(): boolean {
  return parseBoolEnv("UWE_UPLOAD_STRIP_EXIF", true);
}

export function shouldGenerateThumbnails(): boolean {
  return parseBoolEnv("UWE_UPLOAD_GENERATE_THUMBNAILS", true);
}

type SharpModule = typeof import("sharp");

async function loadSharp(): Promise<SharpModule | null> {
  try {
    const mod = await import("sharp");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

/**
 * Optionally strip EXIF metadata and generate a WebP thumbnail for raster images.
 * Falls back to the original buffer when sharp is unavailable.
 */
export async function processUploadedImage(input: {
  buffer: Buffer;
  mimeType: string;
  worldId: string;
  storageKey: string;
  uploadsRoot?: string;
}): Promise<ProcessedImageResult> {
  const sharp = await loadSharp();
  if (!sharp) {
    return {
      buffer: input.buffer,
      mimeType: input.mimeType,
      size: input.buffer.length,
      exifStripped: false,
    };
  }

  let processed = sharp(input.buffer, { failOn: "error" });
  let exifStripped = false;

  if (shouldStripExif()) {
    processed = processed.rotate(); // auto-orient + strip orientation EXIF
    exifStripped = true;
  }

  const outputBuffer = await processed.toBuffer();
  const result: ProcessedImageResult = {
    buffer: outputBuffer,
    mimeType: input.mimeType,
    size: outputBuffer.length,
    exifStripped,
  };

  if (!shouldGenerateThumbnails()) {
    return result;
  }

  try {
    const thumbBuffer = await sharp(outputBuffer)
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const thumbnailStorageKey = buildThumbnailStorageKey(input.worldId, input.storageKey);
    const thumbPath = resolveAssetFilePath(thumbnailStorageKey, undefined, input.uploadsRoot);
    fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
    fs.writeFileSync(thumbPath, thumbBuffer);
    result.thumbnailStorageKey = thumbnailStorageKey;
  } catch {
    // Thumbnail generation is best-effort.
  }

  return result;
}
