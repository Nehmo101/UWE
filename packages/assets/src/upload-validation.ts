export const DEFAULT_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

const BLOCKED_MIME_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "image/svg+xml",
  "text/xml",
  "application/xml",
]);

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
]);

export interface UploadValidationResult {
  ok: true;
  mimeType: string;
}

export interface UploadValidationError {
  ok: false;
  error: string;
}

export type UploadValidation = UploadValidationResult | UploadValidationError;

function readMagicSignature(buffer: Buffer, length = 12): string {
  return buffer.subarray(0, Math.min(length, buffer.length)).toString("hex");
}

function detectMimeFromMagic(buffer: Buffer): string | null {
  if (buffer.length < 4) {
    return null;
  }

  const hex = readMagicSignature(buffer, 12);
  const ascii = buffer.subarray(0, 12).toString("ascii");

  if (hex.startsWith("89504e47")) return "image/png";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (ascii.startsWith("GIF8")) return "image/gif";
  if (ascii.startsWith("RIFF") && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (ascii.startsWith("%PDF")) return "application/pdf";
  if (ascii.startsWith("ID3") || hex.startsWith("fff")) return "audio/mpeg";
  if (ascii.startsWith("OggS")) return "audio/ogg";
  if (ascii.startsWith("RIFF") && buffer.subarray(8, 12).toString("ascii") === "WAVE") {
    return "audio/wav";
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return "video/mp4";
  }
  if (hex.startsWith("1a45dfa3")) return "video/webm";

  return null;
}

function resolveUploadMaxBytes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.UPLOAD_MAX_BYTES?.trim();
  if (!raw) {
    return DEFAULT_UPLOAD_MAX_BYTES;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_UPLOAD_MAX_BYTES;
  }

  return parsed;
}

export function validateUploadBuffer(
  buffer: Buffer,
  declaredMimeType: string | null | undefined,
  filename: string,
  env: NodeJS.ProcessEnv = process.env,
): UploadValidation {
  const maxBytes = resolveUploadMaxBytes(env);

  if (buffer.length === 0) {
    return { ok: false, error: "Leere Datei." };
  }

  if (buffer.length > maxBytes) {
    return {
      ok: false,
      error: `Datei überschreitet das Limit von ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    };
  }

  const detected = detectMimeFromMagic(buffer);
  const normalizedDeclared = declaredMimeType?.split(";")[0]?.trim().toLowerCase() || null;

  if (normalizedDeclared && BLOCKED_MIME_TYPES.has(normalizedDeclared)) {
    return { ok: false, error: "Dateityp ist aus Sicherheitsgründen nicht erlaubt." };
  }

  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
  if ([".html", ".htm", ".js", ".mjs", ".svg", ".xml", ".xhtml"].includes(ext)) {
    return { ok: false, error: "Dateiendung ist aus Sicherheitsgründen nicht erlaubt." };
  }

  const mimeType = detected ?? normalizedDeclared;
  if (!mimeType) {
    return { ok: false, error: "Dateityp konnte nicht ermittelt werden." };
  }

  if (BLOCKED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "Dateityp ist aus Sicherheitsgründen nicht erlaubt." };
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "Dateityp ist nicht erlaubt." };
  }

  if (normalizedDeclared && ALLOWED_MIME_TYPES.has(normalizedDeclared)) {
    if (!detected) {
      return { ok: false, error: "Dateiinhalt konnte nicht verifiziert werden." };
    }
    if (detected !== normalizedDeclared) {
      return { ok: false, error: "Dateiinhalt stimmt nicht mit dem deklarierten MIME-Typ überein." };
    }
  }

  return { ok: true, mimeType };
}

export function assetContentDisposition(
  mimeType: string | null | undefined,
  filename: string,
): { inline: boolean; header: string } {
  const normalized = mimeType?.split(";")[0]?.trim().toLowerCase() ?? "";
  const dangerous =
    normalized === "image/svg+xml" ||
    normalized.startsWith("text/") ||
    normalized.includes("javascript") ||
    normalized.includes("html");

  const disposition = dangerous ? "attachment" : "inline";
  return {
    inline: disposition === "inline",
    header: `${disposition}; filename="${encodeURIComponent(filename)}"`,
  };
}
