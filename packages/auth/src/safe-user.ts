import type { SafeUser } from "./types";
import { toAreaAccess } from "./area-access";

const SENSITIVE_USER_FIELDS = new Set([
  "passwordhash",
  "password_hash",
  "resettokenhash",
  "reset_token_hash",
  "resettokenexpiresat",
  "reset_token_expires_at",
  "invitetokenhash",
  "invite_token_hash",
  "invitetokenexpiresat",
  "invite_token_expires_at",
  "twofactorsecret",
  "twofactorchallenges",
  "sessions",
  "apitokens",
  "token",
  "sessiontoken",
  "session_token",
]);

function toIsoString(value: unknown): string | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return undefined;
}

export function toSafeUser(user: Record<string, unknown>): SafeUser {
  const safe: SafeUser = {
    id: String(user.id),
    displayName: String(user.displayName),
    email: typeof user.email === "string" ? user.email : null,
    isOwner: user.isOwner === true,
    access: toAreaAccess(user as Parameters<typeof toAreaAccess>[0]),
  };

  const createdAt = toIsoString(user.createdAt);
  if (createdAt) {
    safe.createdAt = createdAt;
  }

  const updatedAt = toIsoString(user.updatedAt);
  if (updatedAt) {
    safe.updatedAt = updatedAt;
  }

  if (typeof user.forcePasswordChange === "boolean") {
    safe.forcePasswordChange = user.forcePasswordChange;
  }

  if (user.status === "invited" || user.status === "active" || user.status === "disabled") {
    safe.status = user.status;
  }

  const emailVerifiedAt = toIsoString(user.emailVerifiedAt);
  if (emailVerifiedAt) {
    safe.emailVerifiedAt = emailVerifiedAt;
  }

  const lastLoginAt = toIsoString(user.lastLoginAt);
  if (lastLoginAt) {
    safe.lastLoginAt = lastLoginAt;
  }

  safe.hasPassword = Boolean(user.passwordHash ?? user.password_hash);

  return safe;
}

export function stripSensitiveUserFields<T extends Record<string, unknown>>(value: T): Partial<T> {
  const result: Record<string, unknown> = {};

  for (const [key, fieldValue] of Object.entries(value)) {
    if (SENSITIVE_USER_FIELDS.has(key.toLowerCase())) {
      continue;
    }

    if (fieldValue && typeof fieldValue === "object" && !Array.isArray(fieldValue)) {
      result[key] = stripSensitiveUserFields(fieldValue as Record<string, unknown>);
      continue;
    }

    result[key] = fieldValue;
  }

  return result as Partial<T>;
}
