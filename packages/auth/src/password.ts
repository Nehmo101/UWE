import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const FORMAT_PREFIX = "scrypt";
const FORMAT_VERSION = "v1";
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

interface ParsedPasswordHash {
  salt: string;
  hashHex: string;
}

function parseStoredHash(storedHash: string): ParsedPasswordHash | null {
  const parts = storedHash.split(":");

  if (parts.length === 4 && parts[0] === FORMAT_PREFIX && parts[1] === FORMAT_VERSION) {
    const [, , salt, hashHex] = parts;
    if (!salt || !hashHex) {
      return null;
    }
    return { salt, hashHex };
  }

  // Legacy format: "<salt>:<hash>"
  if (parts.length === 2) {
    const [salt, hashHex] = parts;
    if (!salt || !hashHex) {
      return null;
    }
    return { salt, hashHex };
  }

  return null;
}

function timingSafeHashEqual(candidate: Buffer, expectedHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  if (candidate.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(candidate, expected);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${FORMAT_PREFIX}:${FORMAT_VERSION}:${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parseStoredHash(storedHash);
  if (!parsed) {
    return false;
  }

  try {
    const candidate = (await scryptAsync(password, parsed.salt, KEY_LENGTH)) as Buffer;
    return timingSafeHashEqual(candidate, parsed.hashHex);
  } catch {
    return false;
  }
}

/** Re-hash legacy `salt:hash` records to the versioned scrypt format. */
export function isLegacyPasswordHash(storedHash: string): boolean {
  const parts = storedHash.split(":");
  return parts.length === 2 && parts[0] !== FORMAT_PREFIX;
}
