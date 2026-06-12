import crypto from "node:crypto";

export function generateAuthSecret(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
