import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const normalized = input.replace(/=+$/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 secret.");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function generateTotpCode(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function verifyTotpCode(
  secret: string,
  token: string,
  options: { window?: number; nowMs?: number } = {},
): boolean {
  const normalized = token.replace(/\s+/g, "");
  if (!/^\d{6,8}$/.test(normalized)) {
    return false;
  }

  const window = options.window ?? 1;
  const counter = Math.floor((options.nowMs ?? Date.now()) / 1000 / TOTP_STEP_SECONDS);

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateTotpCode(secret, counter + offset);
    const left = Buffer.from(normalized.padStart(TOTP_DIGITS, "0"));
    const right = Buffer.from(expected);
    if (left.length === right.length && timingSafeEqual(left, right)) {
      return true;
    }
  }

  return false;
}

export function buildTotpAuthUri(
  secret: string,
  options: { issuer?: string; accountName?: string } = {},
): string {
  const issuer = encodeURIComponent(options.issuer ?? "UWE");
  const account = encodeURIComponent(options.accountName ?? "user");
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&period=${TOTP_STEP_SECONDS}&digits=${TOTP_DIGITS}`;
}
