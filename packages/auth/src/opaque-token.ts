import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

function resolveOpaqueTokenSalt(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.API_TOKEN_HASH_SALT?.trim() ||
    env.AUTH_SECRET?.trim() ||
    env.SESSION_SECRET?.trim() ||
    "uwe-opaque-token-dev-salt"
  );
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashOpaqueToken(token: string, env: NodeJS.ProcessEnv = process.env): string {
  return createHash("sha256")
    .update(`${resolveOpaqueTokenSalt(env)}:${token}`)
    .digest("hex");
}

export function verifyOpaqueToken(
  token: string,
  expectedHash: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const provided = Buffer.from(hashOpaqueToken(token, env));
  const expected = Buffer.from(expectedHash);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
