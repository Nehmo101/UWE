import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_SECONDS = 60 * 15;

function resolveMediaSigningSecret(): string {
  return process.env.UWE_MEDIA_SIGNING_SECRET?.trim() || "uwe-dev-media-signing-secret";
}

export interface SignedMediaPayload {
  assetId: string;
  worldSlug: string;
  expiresAt: number;
}

function encodePayload(payload: SignedMediaPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(encoded: string): SignedMediaPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SignedMediaPayload;
    if (
      typeof parsed.assetId !== "string" ||
      typeof parsed.worldSlug !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createSignedMediaToken(
  input: Omit<SignedMediaPayload, "expiresAt"> & { ttlSeconds?: number },
  secret = resolveMediaSigningSecret(),
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const payload: SignedMediaPayload = {
    assetId: input.assetId,
    worldSlug: input.worldSlug,
    expiresAt,
  };
  const encoded = encodePayload(payload);
  const signature = sign(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifySignedMediaToken(
  token: string,
  expected: Pick<SignedMediaPayload, "assetId" | "worldSlug">,
  secret = resolveMediaSigningSecret(),
): boolean {
  const [encoded, providedSignature] = token.split(".");
  if (!encoded || !providedSignature) {
    return false;
  }

  const expectedSignature = sign(encoded, secret);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return false;
  }

  const payload = decodePayload(encoded);
  if (!payload) {
    return false;
  }

  if (payload.assetId !== expected.assetId || payload.worldSlug !== expected.worldSlug) {
    return false;
  }

  return payload.expiresAt >= Math.floor(Date.now() / 1000);
}

export function buildSignedMediaUrl(
  basePath: string,
  input: Omit<SignedMediaPayload, "expiresAt"> & { ttlSeconds?: number },
  secret = resolveMediaSigningSecret(),
): string {
  const token = createSignedMediaToken(input, secret);
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}sig=${encodeURIComponent(token)}`;
}

export function isProtectedMediaVisibility(
  visibility: string,
): boolean {
  return (
    visibility === "private" ||
    visibility === "dm_only" ||
    visibility === "archived" ||
    visibility === "specific_players" ||
    visibility === "unlock_after_session"
  );
}

export function requiresSignedMediaAccess(visibility: string): boolean {
  return isProtectedMediaVisibility(visibility);
}
