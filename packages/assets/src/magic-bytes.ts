/** Detected file category from magic bytes / content heuristics. */
export type DetectedFileKind =
  | "png"
  | "jpeg"
  | "gif"
  | "webp"
  | "pdf"
  | "text"
  | "mp3"
  | "wav"
  | "ogg"
  | "mp4"
  | "webm"
  | "html"
  | "svg"
  | "executable"
  | "unknown";

export interface MagicByteDetection {
  kind: DetectedFileKind;
  mimeType: string | null;
}

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buffer[offset + i] !== bytes[i]) return false;
  }
  return true;
}

function readAscii(buffer: Buffer, start: number, length: number): string {
  return buffer.subarray(start, start + length).toString("ascii");
}

function looksLikeText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  if (sample.includes(0)) return false;
  try {
    const text = sample.toString("utf8");
    return !text.includes("\uFFFD");
  } catch {
    return false;
  }
}

function looksLikeHtml(buffer: Buffer): boolean {
  const head = buffer.subarray(0, Math.min(buffer.length, 512)).toString("utf8").trimStart().toLowerCase();
  return (
    head.startsWith("<!doctype html") ||
    head.startsWith("<html") ||
    head.includes("<script") ||
    head.includes("javascript:")
  );
}

function looksLikeSvg(buffer: Buffer): boolean {
  const head = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"));
}

/** Map file extension (with dot) to expected detection kind. */
export const EXTENSION_TO_KIND: Record<string, DetectedFileKind> = {
  ".png": "png",
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".gif": "gif",
  ".webp": "webp",
  ".pdf": "pdf",
  ".md": "text",
  ".txt": "text",
  ".mp3": "mp3",
  ".wav": "wav",
  ".ogg": "ogg",
  ".mp4": "mp4",
  ".webm": "webm",
};

export const KIND_TO_MIME: Record<DetectedFileKind, string | null> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  text: "text/plain",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
  html: "text/html",
  svg: "image/svg+xml",
  executable: null,
  unknown: null,
};

/** Dangerous extensions that must never be uploaded. */
export const BLOCKED_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".xhtml",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".svg",
  ".xml",
  ".exe",
  ".dll",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".sh",
  ".bash",
  ".php",
  ".asp",
  ".aspx",
  ".jsp",
  ".jar",
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".wasm",
  ".vbs",
  ".ps1",
]);

export function detectFileKind(buffer: Buffer): MagicByteDetection {
  if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return { kind: "executable", mimeType: null };
  }
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { kind: "executable", mimeType: null };
  }

  if (looksLikeHtml(buffer)) {
    return { kind: "html", mimeType: "text/html" };
  }
  if (looksLikeSvg(buffer)) {
    return { kind: "svg", mimeType: "image/svg+xml" };
  }

  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "png", mimeType: "image/png" };
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { kind: "jpeg", mimeType: "image/jpeg" };
  }
  if (buffer.length >= 6 && (readAscii(buffer, 0, 6) === "GIF87a" || readAscii(buffer, 0, 6) === "GIF89a")) {
    return { kind: "gif", mimeType: "image/gif" };
  }
  if (
    buffer.length >= 12 &&
    readAscii(buffer, 0, 4) === "RIFF" &&
    readAscii(buffer, 8, 4) === "WEBP"
  ) {
    return { kind: "webp", mimeType: "image/webp" };
  }
  if (buffer.length >= 5 && readAscii(buffer, 0, 5) === "%PDF-") {
    return { kind: "pdf", mimeType: "application/pdf" };
  }
  if (buffer.length >= 3 && readAscii(buffer, 0, 3) === "ID3") {
    return { kind: "mp3", mimeType: "audio/mpeg" };
  }
  if (startsWith(buffer, [0xff, 0xfb]) || startsWith(buffer, [0xff, 0xf3]) || startsWith(buffer, [0xff, 0xf2])) {
    return { kind: "mp3", mimeType: "audio/mpeg" };
  }
  if (
    buffer.length >= 12 &&
    readAscii(buffer, 0, 4) === "RIFF" &&
    readAscii(buffer, 8, 4) === "WAVE"
  ) {
    return { kind: "wav", mimeType: "audio/wav" };
  }
  if (buffer.length >= 4 && readAscii(buffer, 0, 4) === "OggS") {
    return { kind: "ogg", mimeType: "audio/ogg" };
  }
  if (buffer.length >= 12 && readAscii(buffer, 4, 4) === "ftyp") {
    return { kind: "mp4", mimeType: "video/mp4" };
  }
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { kind: "webm", mimeType: "video/webm" };
  }
  if (looksLikeText(buffer)) {
    return { kind: "text", mimeType: "text/plain" };
  }

  return { kind: "unknown", mimeType: null };
}

export function extensionForKind(kind: DetectedFileKind): string | null {
  switch (kind) {
    case "png":
      return ".png";
    case "jpeg":
      return ".jpg";
    case "gif":
      return ".gif";
    case "webp":
      return ".webp";
    case "pdf":
      return ".pdf";
    case "text":
      return ".txt";
    case "mp3":
      return ".mp3";
    case "wav":
      return ".wav";
    case "ogg":
      return ".ogg";
    case "mp4":
      return ".mp4";
    case "webm":
      return ".webm";
    default:
      return null;
  }
}
