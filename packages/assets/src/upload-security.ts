/** Default max upload size: 50 MiB. Override with UWE_MAX_UPLOAD_BYTES. */
export const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = ["image/", "audio/", "video/"] as const;

const ALLOWED_EXACT_MIMES = new Set([
  "application/pdf",
  "application/octet-stream",
]);

const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".ps1",
  ".vbs",
  ".js",
  ".mjs",
  ".cjs",
  ".sh",
  ".php",
  ".html",
  ".htm",
  ".svg",
]);

export interface UploadValidationInput {
  size: number;
  mimeType: string | null | undefined;
  filename: string;
}

export type UploadValidationResult =
  | {
      ok: true;
      mimeType: string;
    }
  | {
      ok: false;
      error: string;
      code: "empty" | "too_large" | "blocked_extension" | "blocked_mime";
    };

export function resolveMaxUploadBytes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.UWE_MAX_UPLOAD_BYTES?.trim();
  if (!raw) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_BYTES;
}

export function isAllowedUploadMime(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (ALLOWED_EXACT_MIMES.has(normalized)) {
    return true;
  }
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function validateUpload(
  input: UploadValidationInput,
  env: NodeJS.ProcessEnv = process.env,
): UploadValidationResult {
  if (input.size <= 0) {
    return { ok: false, error: "Datei ist leer.", code: "empty" };
  }

  const maxBytes = resolveMaxUploadBytes(env);
  if (input.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return {
      ok: false,
      error: `Datei ist zu groß (max. ${maxMb} MiB).`,
      code: "too_large",
    };
  }

  const ext = extractExtension(input.filename);
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: `Dateityp ${ext} ist nicht erlaubt.`,
      code: "blocked_extension",
    };
  }

  const mimeType = (input.mimeType?.trim() || "application/octet-stream").toLowerCase();
  if (!isAllowedUploadMime(mimeType)) {
    return {
      ok: false,
      error: `MIME-Typ ${mimeType} ist nicht erlaubt.`,
      code: "blocked_mime",
    };
  }

  return { ok: true, mimeType };
}

function extractExtension(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) {
    return null;
  }
  return filename.slice(dot).toLowerCase();
}
