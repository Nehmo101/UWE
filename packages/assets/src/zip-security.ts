import path from "node:path";
import AdmZip from "adm-zip";
import { BLOCKED_EXTENSIONS, detectFileKind } from "./magic-bytes";

export class ZipSecurityError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "ZipSecurityError";
    this.code = code;
  }
}

const DEFAULT_MAX_ZIP_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const DEFAULT_MAX_FILES = 500;

export interface ZipImportPolicy {
  maxZipBytes: number;
  maxUncompressedBytes: number;
  maxFiles: number;
}

export interface SafeZipEntry {
  entryName: string;
  data: Buffer;
}

export function resolveZipImportPolicy(): ZipImportPolicy {
  return {
    maxZipBytes: parsePositiveIntEnv("UWE_ZIP_IMPORT_MAX_BYTES", DEFAULT_MAX_ZIP_BYTES),
    maxUncompressedBytes: parsePositiveIntEnv(
      "UWE_ZIP_IMPORT_MAX_UNCOMPRESSED_BYTES",
      DEFAULT_MAX_UNCOMPRESSED_BYTES,
    ),
    maxFiles: parsePositiveIntEnv("UWE_ZIP_IMPORT_MAX_FILES", DEFAULT_MAX_FILES),
  };
}

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Reject path traversal, absolute paths, and Windows drive prefixes in ZIP entry names. */
export function assertSafeZipEntryName(entryName: string): void {
  const normalized = entryName.replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    normalized.includes("../") ||
    normalized.includes("/../") ||
    normalized.startsWith("..") ||
    /^[a-zA-Z]:/.test(normalized)
  ) {
    throw new ZipSecurityError(`Unsafe ZIP entry path: ${entryName}`, "zip_slip");
  }
}

function isBlockedZipEntry(entryName: string): boolean {
  const ext = path.extname(entryName).toLowerCase();
  return BLOCKED_EXTENSIONS.has(ext);
}

/**
 * Validate and extract allowed entries from a ZIP buffer.
 * Used for backup restore asset extraction with zip-slip and bomb protection.
 */
export function extractSafeZipEntries(
  zipInput: string | Buffer,
  options?: {
    policy?: ZipImportPolicy;
    allowedPrefix?: string;
    requirePrefix?: boolean;
  },
): SafeZipEntry[] {
  const policy = options?.policy ?? resolveZipImportPolicy();
  const zipBuffer = Buffer.isBuffer(zipInput) ? zipInput : Buffer.from(zipInput);

  if (zipBuffer.length > policy.maxZipBytes) {
    throw new ZipSecurityError(
      `ZIP archive exceeds maximum size of ${policy.maxZipBytes} bytes.`,
      "zip_too_large",
    );
  }

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);

  if (entries.length > policy.maxFiles) {
    throw new ZipSecurityError(
      `ZIP archive contains too many files (${entries.length} > ${policy.maxFiles}).`,
      "too_many_files",
    );
  }

  let totalUncompressed = 0;
  const result: SafeZipEntry[] = [];

  for (const entry of entries) {
    assertSafeZipEntryName(entry.entryName);

    if (options?.requirePrefix && options.allowedPrefix) {
      const prefix = options.allowedPrefix.endsWith("/")
        ? options.allowedPrefix
        : `${options.allowedPrefix}/`;
      if (!entry.entryName.startsWith(prefix)) {
        continue;
      }
    }

    if (isBlockedZipEntry(entry.entryName)) {
      throw new ZipSecurityError(
        `ZIP contains blocked file type: ${entry.entryName}`,
        "blocked_entry",
      );
    }

    const data = entry.getData();
    totalUncompressed += data.length;
    if (totalUncompressed > policy.maxUncompressedBytes) {
      throw new ZipSecurityError(
        `Uncompressed ZIP content exceeds limit of ${policy.maxUncompressedBytes} bytes.`,
        "zip_bomb",
      );
    }

    const detection = detectFileKind(data);
    if (
      detection.kind === "html" ||
      detection.kind === "svg" ||
      detection.kind === "executable"
    ) {
      throw new ZipSecurityError(
        `ZIP contains disallowed content in ${entry.entryName}.`,
        "blocked_content",
      );
    }

    result.push({ entryName: entry.entryName, data });
  }

  return result;
}
