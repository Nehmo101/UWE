import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  BLOCKED_EXTENSIONS,
  EXTENSION_TO_KIND,
  KIND_TO_MIME,
  detectFileKind,
  extensionForKind,
  type DetectedFileKind,
} from "./magic-bytes";

export class UploadValidationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "UploadValidationError";
    this.code = code;
  }
}

/** Allowed upload kinds grouped by category. */
export const ALLOWED_UPLOAD_KINDS: ReadonlySet<DetectedFileKind> = new Set([
  "png",
  "jpeg",
  "gif",
  "webp",
  "pdf",
  "text",
  "mp3",
  "wav",
  "ogg",
  "mp4",
  "webm",
]);

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

export interface UploadPolicyConfig {
  maxBytes: number;
  allowedKinds: ReadonlySet<DetectedFileKind>;
  allowDocuments: boolean;
  allowGif: boolean;
}

export interface ValidatedUpload {
  buffer: Buffer;
  kind: DetectedFileKind;
  mimeType: string;
  extension: string;
  storageKey: string;
  size: number;
  originalFilename: string | null;
}

export function resolveUploadPolicyConfig(): UploadPolicyConfig {
  const maxBytes = resolveMaxUploadBytesEnv(DEFAULT_MAX_BYTES);
  const allowDocuments = parseBoolEnv("UWE_UPLOAD_ALLOW_DOCUMENTS", true);
  const allowGif = parseBoolEnv("UWE_UPLOAD_ALLOW_GIF", true);

  const allowedKinds = new Set(ALLOWED_UPLOAD_KINDS);
  if (!allowDocuments) {
    allowedKinds.delete("pdf");
    allowedKinds.delete("text");
  }
  if (!allowGif) {
    allowedKinds.delete("gif");
  }

  return { maxBytes, allowedKinds, allowDocuments, allowGif };
}

export function resolveUploadMaxBytes(): number {
  return resolveUploadPolicyConfig().maxBytes;
}

/**
 * Resolve the max upload size from the environment.
 *
 * `UWE_UPLOAD_MAX_BYTES` is the canonical variable. For back-compat with the
 * removed `upload-validation.ts` / `upload-security.ts` modules we also accept
 * their legacy variables as fallbacks, in this precedence order:
 *   1. `UWE_UPLOAD_MAX_BYTES` (canonical)
 *   2. `UPLOAD_MAX_BYTES`     (legacy, from upload-validation.ts)
 *   3. `UWE_MAX_UPLOAD_BYTES` (legacy, from upload-security.ts)
 */
function resolveMaxUploadBytesEnv(fallback: number): number {
  for (const name of ["UWE_UPLOAD_MAX_BYTES", "UPLOAD_MAX_BYTES", "UWE_MAX_UPLOAD_BYTES"]) {
    const raw = process.env[name]?.trim();
    if (!raw) continue;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return fallback;
}

/** Escape original filename for safe metadata storage (no path components). */
export function sanitizeOriginalFilename(filename: string | null | undefined): string | null {
  if (!filename?.trim()) return null;
  const normalized = filename.trim().replace(/\\/g, "/");
  const base = path.basename(normalized);
  const cleaned = base.replace(/[\x00-\x1f\x7f]/g, "").replace(/[/\\]/g, "-").slice(0, 255);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Build a storage key that never embeds user-supplied path segments.
 * Format: `{worldId}/{uuid}{ext}` — extension comes from validated allowlist only.
 */
export function buildSecureStorageKey(worldId: string, extension: string): string {
  const safeExt = extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  if (!(safeExt in EXTENSION_TO_KIND)) {
    throw new UploadValidationError(`Extension ${safeExt} is not allowed for storage keys.`, "invalid_extension");
  }
  return path.posix.join(worldId, `${randomUUID()}${safeExt}`);
}

export function buildThumbnailStorageKey(worldId: string, mainStorageKey: string): string {
  const baseName = path.posix.basename(mainStorageKey, path.posix.extname(mainStorageKey));
  return path.posix.join(worldId, `${baseName}.thumb.webp`);
}

function normalizeExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

function isBlockedExtension(ext: string): boolean {
  return BLOCKED_EXTENSIONS.has(ext);
}

function mimeMatchesKind(declaredMime: string | null | undefined, kind: DetectedFileKind): boolean {
  if (!declaredMime?.trim()) return true;
  const normalized = declaredMime.split(";")[0]?.trim().toLowerCase() ?? "";
  const expected = KIND_TO_MIME[kind];
  if (!expected) return false;
  if (normalized === expected) return true;
  if (kind === "jpeg" && normalized === "image/jpg") return true;
  if (kind === "text" && (normalized === "text/markdown" || normalized === "text/plain")) return true;
  if (kind === "mp3" && normalized === "audio/mp3") return true;
  return false;
}

export function validateUploadInput(input: {
  buffer: Buffer;
  originalFilename?: string | null;
  declaredMimeType?: string | null;
  worldId: string;
  config?: UploadPolicyConfig;
}): ValidatedUpload {
  const config = input.config ?? resolveUploadPolicyConfig();
  const originalFilename = sanitizeOriginalFilename(input.originalFilename);
  const ext = originalFilename ? normalizeExtension(originalFilename) : "";

  if (input.buffer.length === 0) {
    throw new UploadValidationError("Empty file.", "empty_file");
  }
  if (input.buffer.length > config.maxBytes) {
    throw new UploadValidationError(
      `File exceeds maximum size of ${config.maxBytes} bytes.`,
      "file_too_large",
    );
  }
  if (ext && isBlockedExtension(ext)) {
    throw new UploadValidationError(`File extension ${ext} is not allowed.`, "blocked_extension");
  }

  const detection = detectFileKind(input.buffer);

  if (detection.kind === "html") {
    throw new UploadValidationError("HTML uploads are not allowed.", "blocked_html");
  }
  if (detection.kind === "svg") {
    throw new UploadValidationError("SVG uploads are not allowed.", "blocked_svg");
  }
  if (detection.kind === "executable") {
    throw new UploadValidationError("Executable files are not allowed.", "blocked_executable");
  }
  if (detection.kind === "unknown") {
    throw new UploadValidationError("Unrecognized or unsupported file type.", "unknown_type");
  }
  if (!config.allowedKinds.has(detection.kind)) {
    throw new UploadValidationError(`File type ${detection.kind} is not allowed.`, "disallowed_type");
  }

  if (ext) {
    const expectedFromExt = EXTENSION_TO_KIND[ext];
    if (expectedFromExt && expectedFromExt !== detection.kind) {
      if (!(ext === ".md" && detection.kind === "text") && !(ext === ".txt" && detection.kind === "text")) {
        throw new UploadValidationError(
          `File content does not match extension ${ext}.`,
          "mime_extension_mismatch",
        );
      }
    }
  }

  if (!mimeMatchesKind(input.declaredMimeType, detection.kind)) {
    throw new UploadValidationError(
      `Declared MIME type does not match file content (${detection.kind}).`,
      "mime_mismatch",
    );
  }

  const resolvedExt = ext && EXTENSION_TO_KIND[ext] === detection.kind
    ? ext
    : extensionForKind(detection.kind);
  if (!resolvedExt) {
    throw new UploadValidationError("Could not resolve file extension.", "invalid_extension");
  }

  const mimeType = KIND_TO_MIME[detection.kind] ?? "application/octet-stream";
  const storageKey = buildSecureStorageKey(input.worldId, resolvedExt);

  return {
    buffer: input.buffer,
    kind: detection.kind,
    mimeType,
    extension: resolvedExt,
    storageKey,
    size: input.buffer.length,
    originalFilename,
  };
}

/** Validate visibility enum from user input — defaults to dm_only (private). */
export function parseUploadVisibility(raw: string | null | undefined): "dm_only" | "player_visible" | "public" {
  const value = String(raw ?? "dm_only").trim();
  if (value === "player_visible" || value === "public") return value;
  return "dm_only";
}
