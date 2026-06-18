import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

function resolveTokenHashSalt(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.API_TOKEN_HASH_SALT?.trim() ||
    env.AUTH_SECRET?.trim() ||
    env.SESSION_SECRET?.trim() ||
    "uwe-api-token-dev-salt"
  );
}

export function generateApiTokenValue(): string {
  return `uwe_${randomBytes(32).toString("hex")}`;
}

export function hashApiToken(token: string, env: NodeJS.ProcessEnv = process.env): string {
  return createHash("sha256")
    .update(`${resolveTokenHashSalt(env)}:${token}`)
    .digest("hex");
}

export function verifyApiTokenHash(
  token: string,
  expectedHash: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const provided = Buffer.from(hashApiToken(token, env));
  const expected = Buffer.from(expectedHash);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
