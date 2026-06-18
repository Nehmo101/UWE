import type { SafeUser, UweRole } from "@uwe/auth";
import { toSafeUser } from "@uwe/auth";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  verifyOpaqueToken,
  verifyPassword,
} from "@uwe/auth/server";
import type { PrismaClient } from "./client";
import type { UserRole } from "./generated/prisma/client";
import { logAuditEvent } from "./audit-log-service";

const DEFAULT_INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const USER_SAFE_SELECT = {
  id: true,
  displayName: true,
  email: true,
  role: true,
  passwordHash: true,
  forcePasswordChange: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface CreateManagedUserInput {
  displayName: string;
  email?: string | null;
  password?: string | null;
  role?: UserRole;
  actorUserId: string;
}

export interface UpdateManagedUserInput {
  displayName?: string;
  email?: string | null;
  role?: UserRole;
  forcePasswordChange?: boolean;
}

export interface ResetPasswordInput {
  userId: string;
  newPassword: string;
  actorUserId: string;
  forcePasswordChange?: boolean;
}

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
  keepSessionToken?: string | null;
}

export type ChangePasswordResult = "ok" | "invalid_current" | "no_password" | "not_found";

export interface InviteUserResult {
  user: SafeUser;
  inviteToken: string;
  expiresAt: Date;
}

export class UserService {
  constructor(private readonly db: PrismaClient) {}

  async listUsers(): Promise<SafeUser[]> {
    const users = await this.db.user.findMany({
      select: USER_SAFE_SELECT,
      orderBy: [{ displayName: "asc" }],
    });
    return users.map((user) => toSafeUser(user));
  }

  async getUserById(userId: string): Promise<SafeUser | null> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: USER_SAFE_SELECT,
    });
    return user ? toSafeUser(user) : null;
  }

  async createUser(input: CreateManagedUserInput): Promise<SafeUser> {
    const passwordHash = input.password ? await hashPassword(input.password) : null;

    const user = await this.db.user.create({
      data: {
        displayName: input.displayName.trim(),
        email: input.email?.trim().toLowerCase() ?? null,
        passwordHash,
        role: input.role ?? "player",
      },
      select: USER_SAFE_SELECT,
    });

    await logAuditEvent(this.db, {
      actorUserId: input.actorUserId,
      action: "user_created",
      targetType: "user",
      targetId: user.id,
      metadata: {
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
    });

    return toSafeUser(user);
  }

  async updateUser(userId: string, input: UpdateManagedUserInput): Promise<SafeUser | null> {
    const existing = await this.db.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return null;
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email?.trim().toLowerCase() ?? null } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.forcePasswordChange !== undefined
          ? { forcePasswordChange: input.forcePasswordChange }
          : {}),
      },
      select: USER_SAFE_SELECT,
    });

    if (input.role !== undefined && input.role !== existing.role) {
      await logAuditEvent(this.db, {
        action: "user_role_changed",
        targetType: "user",
        targetId: userId,
        metadata: {
          from: existing.role,
          to: input.role,
          scope: "global",
        },
      });
    }

    return toSafeUser(updated);
  }

  async resetPassword(input: ResetPasswordInput): Promise<boolean> {
    const existing = await this.db.user.findUnique({ where: { id: input.userId } });
    if (!existing) {
      return false;
    }

    const passwordHash = await hashPassword(input.newPassword);

    await this.db.$transaction([
      this.db.user.update({
        where: { id: input.userId },
        data: {
          passwordHash,
          resetTokenHash: null,
          resetTokenExpiresAt: null,
          forcePasswordChange: input.forcePasswordChange ?? false,
        },
      }),
      this.db.session.deleteMany({ where: { userId: input.userId } }),
    ]);

    await logAuditEvent(this.db, {
      actorUserId: input.actorUserId,
      action: "password_reset",
      targetType: "user",
      targetId: input.userId,
      metadata: {
        displayName: existing.displayName,
        forcedChange: input.forcePasswordChange ?? false,
      },
    });

    return true;
  }

  async changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult> {
    const user = await this.db.user.findUnique({ where: { id: input.userId } });
    if (!user) {
      return "not_found";
    }

    if (!user.passwordHash) {
      return "no_password";
    }

    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      return "invalid_current";
    }

    const passwordHash = await hashPassword(input.newPassword);

    await this.db.$transaction([
      this.db.user.update({
        where: { id: input.userId },
        data: {
          passwordHash,
          forcePasswordChange: false,
          resetTokenHash: null,
          resetTokenExpiresAt: null,
        },
      }),
      input.keepSessionToken
        ? this.db.session.deleteMany({
            where: {
              userId: input.userId,
              NOT: { token: input.keepSessionToken },
            },
          })
        : this.db.session.deleteMany({ where: { userId: input.userId } }),
    ]);

    await logAuditEvent(this.db, {
      actorUserId: input.userId,
      action: "password_changed",
      targetType: "user",
      targetId: input.userId,
      metadata: {
        displayName: user.displayName,
        method: "self_service",
      },
    });

    return "ok";
  }

  async createInvite(input: {
    displayName: string;
    email: string;
    role?: UserRole;
    actorUserId: string;
    expiresAt?: Date;
  }): Promise<InviteUserResult> {
    const inviteToken = generateOpaqueToken();
    const inviteTokenHash = hashOpaqueToken(inviteToken);
    const expiresAt = input.expiresAt ?? new Date(Date.now() + DEFAULT_INVITE_TOKEN_TTL_MS);

    const user = await this.db.user.create({
      data: {
        displayName: input.displayName.trim(),
        email: input.email.trim().toLowerCase(),
        role: input.role ?? "player",
        inviteTokenHash,
        inviteTokenExpiresAt: expiresAt,
      },
      select: USER_SAFE_SELECT,
    });

    await logAuditEvent(this.db, {
      actorUserId: input.actorUserId,
      action: "user_invited",
      targetType: "user",
      targetId: user.id,
      metadata: {
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      user: toSafeUser(user),
      inviteToken,
      expiresAt,
    };
  }

  async acceptInvite(input: {
    email: string;
    inviteToken: string;
    password: string;
  }): Promise<SafeUser | null> {
    const user = await this.db.user.findUnique({
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
    const updated = await this.db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        inviteTokenHash: null,
        inviteTokenExpiresAt: null,
        forcePasswordChange: false,
      },
      select: USER_SAFE_SELECT,
    });

    return toSafeUser(updated);
  }

  async createPasswordResetToken(input: {
    email: string;
    expiresAt?: Date;
  }): Promise<{ resetToken: string; expiresAt: Date } | null> {
    const user = await this.db.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });

    if (!user) {
      return null;
    }

    const resetToken = generateOpaqueToken();
    const resetTokenHash = hashOpaqueToken(resetToken);
    const expiresAt = input.expiresAt ?? new Date(Date.now() + DEFAULT_RESET_TOKEN_TTL_MS);

    await this.db.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash,
        resetTokenExpiresAt: expiresAt,
      },
    });

    return { resetToken, expiresAt };
  }

  async resetPasswordWithToken(input: {
    email: string;
    resetToken: string;
    newPassword: string;
  }): Promise<boolean> {
    const user = await this.db.user.findUnique({
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

    await this.db.$transaction([
      this.db.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetTokenHash: null,
          resetTokenExpiresAt: null,
          forcePasswordChange: false,
        },
      }),
      this.db.session.deleteMany({ where: { userId: user.id } }),
    ]);

    await logAuditEvent(this.db, {
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

  /** Internal auth lookup — never expose the returned record via API. */
  async findUserForAuthentication(email: string) {
    return this.db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }
}

export function createUserService(db: PrismaClient): UserService {
  return new UserService(db);
}

export function isGlobalAdminRole(role: UweRole): boolean {
  return role === "owner" || role === "admin";
}
