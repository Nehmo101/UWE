import type { IncomingMessage } from "node:http";

export function extractToken(request: IncomingMessage): string | undefined {
  const headerToken = request.headers["x-agent-token"];
  if (typeof headerToken === "string" && headerToken.trim()) {
    return headerToken.trim();
  }

  const authorization = request.headers.authorization;
  if (typeof authorization === "string") {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return undefined;
}

export function verifyToken(
  request: IncomingMessage,
  expectedToken: string,
): { ok: true } | { ok: false; reason: "missing" | "invalid" } {
  const provided = extractToken(request);
  if (!provided) {
    return { ok: false, reason: "missing" };
  }

  if (!timingSafeEqual(provided, expectedToken)) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}
