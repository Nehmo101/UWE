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

/**
 * Der Konstruktor, nicht das Modul.
 *
 * Bis sharp 0.34 war `typeof import("sharp")` selbst aufrufbar. Seit 0.35 ist
 * es der Namensraum, und der Konstruktor steckt in `default` — `sharp(buffer)`
 * typte danach nicht mehr. Der Laufzeitpfad (`mod.default ?? mod`) bleibt, weil
 * er beide Modulformate abdeckt.
 */
type SharpConstructor = (typeof import("sharp"))["default"];

async function loadSharp(): Promise<SharpConstructor | null> {
  try {
    const mod = await import("sharp");
    return mod.default ?? (mod as unknown as SharpConstructor);
  } catch {
    return null;
  }
}

export interface DownscaledImage {
  buffer: Buffer;
  mimeType: string;
  /** false, wenn das Original unverändert zurückkommt (kein sharp / Fehler). */
  downscaled: boolean;
}

/**
 * Verkleinert ein Rasterbild für den Vision-/OCR-Connector: Kantenlänge auf
 * `maxDimension` begrenzt (Default 1600px), als JPEG (Default q80) rekomprimiert.
 * Hält die Base64-Payload klein, die als JSON durch die Connector-Queue reist.
 * Ohne sharp (oder bei einem Dekodier-Fehler) bleibt das Original unverändert;
 * der Aufrufer schickt es dann roh.
 */
export async function downscaleImageForVision(input: {
  buffer: Buffer;
  mimeType: string;
  maxDimension?: number;
  quality?: number;
}): Promise<DownscaledImage> {
  const sharp = await loadSharp();
  if (!sharp) {
    return { buffer: input.buffer, mimeType: input.mimeType, downscaled: false };
  }
  const maxDimension = input.maxDimension ?? 1600;
  try {
    const buffer = await sharp(input.buffer, { failOn: "error" })
      .rotate() // auto-orient + strip orientation EXIF
      .resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: input.quality ?? 80 })
      .toBuffer();
    return { buffer, mimeType: "image/jpeg", downscaled: true };
  } catch {
    return { buffer: input.buffer, mimeType: input.mimeType, downscaled: false };
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
