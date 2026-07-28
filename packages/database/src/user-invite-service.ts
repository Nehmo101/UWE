import type { AreaAccessInput, InviteUserResult } from "./user-service";
import { USER_SAFE_SELECT } from "./user-service";
import { toAreaAccess, toSafeUser, type SafeUser } from "@uwe/auth";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  verifyOpaqueToken,
} from "@uwe/auth/server";
import type { PrismaClient } from "./client";
import { logAuditEvent } from "./audit-log-service";

/**
 * Token-based onboarding and recovery: invitations and password-reset links.
 *
 * Split out of `user-service.ts` to keep that file within the module budget.
 * `UserService` still exposes these as methods, so callers are unaffected.
 */

const DEFAULT_INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export type CreateInviteInput = AreaAccessInput & {
  displayName: string;
  email: string;
  isOwner?: boolean;
  actorUserId: string;
  expiresAt?: Date;
};

export async function createInvite(
  db: PrismaClient,
  input: CreateInviteInput,
): Promise<InviteUserResult> {
  const inviteToken = generateOpaqueToken();
  const inviteTokenHash = hashOpaqueToken(inviteToken);
  const expiresAt = input.expiresAt ?? new Date(Date.now() + DEFAULT_INVITE_TOKEN_TTL_MS);

  const user = await db.user.create({
    data: {
      displayName: input.displayName.trim(),
      email: input.email.trim().toLowerCase(),
      isOwner: input.isOwner ?? false,
      portalAccess: input.portalAccess ?? false,
      studioAccess: input.studioAccess ?? false,
      brainAccess: input.brainAccess ?? false,
      familyAccess: input.familyAccess ?? false,
      status: "invited",
      inviteTokenHash,
      inviteTokenExpiresAt: expiresAt,
    },
    select: USER_SAFE_SELECT,
  });

  await logAuditEvent(db, {
    actorUserId: input.actorUserId,
    action: "user_invited",
    targetType: "user",
    targetId: user.id,
    metadata: {
      displayName: user.displayName,
      email: user.email,
      isOwner: user.isOwner,
      access: toAreaAccess(user),
      expiresAt: expiresAt.toISOString(),
    },
  });

  return { user: toSafeUser(user), inviteToken, expiresAt };
}

export async function acceptInvite(
  db: PrismaClient,
  input: { email: string; inviteToken: string; password: string },
): Promise<SafeUser | null> {
  const user = await db.user.findUnique({
    where: { email: input.email.trim().toLowerCase() },
  });

  if (!user?.inviteTokenHash || !user.inviteTokenExpiresAt) {
    return null;
  }

  if (user.inviteTokenExpiresAt <= new Date()) {
    return null;
  }

  if (!verifyOpaqueToken(input.inviteToken, user.inviteTokenHash)) {
    return null;
  }

  const passwordHash = await hashPassword(input.password);
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: "active",
      inviteTokenHash: null,
      inviteTokenExpiresAt: null,
      forcePasswordChange: false,
    },
    select: USER_SAFE_SELECT,
  });

  return toSafeUser(updated);
}

export async function createPasswordResetToken(
  db: PrismaClient,
  input: { email: string; expiresAt?: Date },
): Promise<{ resetToken: string; expiresAt: Date } | null> {
  const user = await db.user.findUnique({
    where: { email: input.email.trim().toLowerCase() },
  });

  if (!user) {
    return null;
  }

  const resetToken = generateOpaqueToken();
  const resetTokenHash = hashOpaqueToken(resetToken);
  const expiresAt = input.expiresAt ?? new Date(Date.now() + DEFAULT_RESET_TOKEN_TTL_MS);

  await db.user.update({
    where: { id: user.id },
    data: { resetTokenHash, resetTokenExpiresAt: expiresAt },
  });

  return { resetToken, expiresAt };
}

export async function resetPasswordWithToken(
  db: PrismaClient,
  input: { email: string; resetToken: string; newPassword: string },
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { email: input.email.trim().toLowerCase() },
  });

  if (!user?.resetTokenHash || !user.resetTokenExpiresAt) {
    return false;
  }

  if (user.resetTokenExpiresAt <= new Date()) {
    return false;
  }

  if (!verifyOpaqueToken(input.resetToken, user.resetTokenHash)) {
    return false;
  }

  const passwordHash = await hashPassword(input.newPassword);

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        forcePasswordChange: false,
      },
    }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);

  await logAuditEvent(db, {
    action: "password_reset",
    targetType: "user",
    targetId: user.id,
    metadata: {
      displayName: user.displayName,
      method: "reset_token",
    },
  });

  return true;
}
