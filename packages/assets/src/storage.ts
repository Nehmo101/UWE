import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveUploadsDirFromEnv } from "./data-paths";
import { EXTENSION_TO_KIND } from "./magic-bytes";
import { buildSecureStorageKey, sanitizeOriginalFilename } from "./upload-policy";
import type { AssetType } from "./types";

/** Default uploads root (gitignored at repo root). */
export const UPLOADS_DIR_NAME = "uploads";

export function resolveUploadsRoot(baseDir?: string, overridePath?: string): string {
  if (overridePath?.trim()) {
    const configured = overridePath.trim();
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(baseDir ?? process.cwd(), configured);
  }

  return resolveUploadsDirFromEnv(baseDir ?? process.cwd());
}

/**
 * Build a storage key from a filename hint. The original name is never used as a path segment.
 */
export function buildStorageKey(worldId: string, filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext && ext in EXTENSION_TO_KIND) {
    return buildSecureStorageKey(worldId, ext);
  }
  return path.posix.join(worldId, randomUUID());
}

export { sanitizeOriginalFilename };

export function resolveAssetFilePath(
  storageKey: string,
  baseDir?: string,
  uploadsRootOverride?: string,
): string {
  const uploadsRoot = resolveUploadsRoot(baseDir, uploadsRootOverride);

  if (!storageKey.trim() || path.isAbsolute(storageKey) || storageKey.includes("\0")) {
    throw new Error("Invalid storage key");
  }

  const normalized = path.normalize(storageKey).replace(/\\/g, "/");
  if (
    normalized.startsWith("..") ||
    normalized.includes("/../") ||
    normalized.endsWith("/..") ||
    normalized.split("/").some((segment) => segment === "..")
  ) {
    throw new Error("Invalid storage key");
  }

  const absolute = path.resolve(uploadsRoot, normalized);
  const rootResolved = path.resolve(uploadsRoot);

  if (!absolute.startsWith(rootResolved + path.sep) && absolute !== rootResolved) {
    throw new Error("Invalid storage key");
  }

  return absolute;
}

export function ensureUploadDirectory(
  worldId: string,
  baseDir?: string,
  uploadsRootOverride?: string,
): string {
  const dir = path.join(resolveUploadsRoot(baseDir, uploadsRootOverride), worldId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function inferAssetTypeFromMime(mimeType: string | null | undefined): AssetType {
  if (!mimeType) return "other";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "document";
  return "other";
}

export function inferMimeTypeFromFilename(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
  };
  return map[ext] ?? null;
}
