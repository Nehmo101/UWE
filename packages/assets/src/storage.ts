import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AssetType } from "./types";

/** Default uploads root (gitignored at repo root). */
export const UPLOADS_DIR_NAME = "uploads";

export function resolveUploadsRoot(baseDir?: string): string {
  if (process.env.UWE_UPLOADS_ROOT) {
    return process.env.UWE_UPLOADS_ROOT;
  }
  const root = baseDir ?? process.cwd();
  return path.join(root, UPLOADS_DIR_NAME);
}

export function buildStorageKey(worldId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const unique = randomUUID().slice(0, 8);
  const ext = path.extname(safeName);
  const base = path.basename(safeName, ext) || "asset";
  return path.posix.join(worldId, `${base}-${unique}${ext}`);
}

export function resolveAssetFilePath(storageKey: string, baseDir?: string): string {
  const uploadsRoot = resolveUploadsRoot(baseDir);
  const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.resolve(uploadsRoot, normalized);
  const rootResolved = path.resolve(uploadsRoot);

  if (!absolute.startsWith(rootResolved + path.sep) && absolute !== rootResolved) {
    throw new Error("Invalid storage key");
  }

  return absolute;
}

export function ensureUploadDirectory(worldId: string, baseDir?: string): string {
  const dir = path.join(resolveUploadsRoot(baseDir), worldId);
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
