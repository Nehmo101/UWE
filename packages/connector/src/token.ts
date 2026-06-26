/**
 * Connector token handling.
 *
 * A connector token authenticates an RTX Host Connector to the UWE Host. The
 * raw token is shown to the operator exactly once (or set manually in the
 * connector's .env) — the host only ever stores a SHA-256 hash, never the
 * plaintext. Verification is timing-safe.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const CONNECTOR_TOKEN_PREFIX = "uwec_";

/** Generate a fresh connector token (raw secret — store only its hash). */
export function generateConnectorToken(): string {
  return `${CONNECTOR_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/** Hash a connector token for at-rest storage and lookup. */
export function hashConnectorToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function looksLikeConnectorToken(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().startsWith(CONNECTOR_TOKEN_PREFIX);
}

/** Constant-time comparison of two token hashes. */
export function connectorTokenHashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/** Verify a raw token against a stored hash (timing-safe). */
export function verifyConnectorToken(rawToken: string, storedHash: string): boolean {
  if (!rawToken.trim() || !storedHash.trim()) {
    return false;
  }
  return connectorTokenHashesEqual(hashConnectorToken(rawToken), storedHash);
}

/** Extract a bearer token from an Authorization header value. */
export function parseConnectorBearer(headerValue: string | null | undefined): string | null {
  if (!headerValue) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}
