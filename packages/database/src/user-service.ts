import type { AreaAccess, SafeUser } from "@uwe/auth";
import { toAreaAccess, toSafeUser } from "@uwe/auth";
import {
  hashOpaqueToken,
  hashPassword,
  verifyPassword,
} from "@uwe/auth/server";
import type { PrismaClient } from "./client";
import { logAuditEvent } from "./audit-log-service";
import {
  acceptInvite,
  createInvite,
  createPasswordResetToken,
  resetPasswordWithToken,
  type CreateInviteInput,
} from "./user-invite-service";

export const USER_SAFE_SELECT = {
  id: true,
  displayName: true,
  email: true,
  isOwner: true,
  portalAccess: true,
  studioAccess: true,
  brainAccess: true,
  familyAccess: true,
  aiAccess: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  passwordHash: true,
  forcePasswordChange: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface AdminUserView extends SafeUser {
  worldMemberships: Array<{
    id: string;
    worldId: string;
    characterName: string | null;
    world: { id: string; name: string; slug: string };
  }>;
}

/**
 * Die vier Häkchen plus das KI-Flag, alle optional — der Aufrufer setzt nur,
 * was er meint. `aiAccess` ist bewusst KEIN fünftes Häkchen: die vier sagen,
 * welche App die Adresse betreten darf, `aiAccess` sagt, ob sie darin die
 * RTX-KI auslösen darf.
 */
export interface AreaAccessInput {
  portalAccess?: boolean;
  studioAccess?: boolean;
  brainAccess?: boolean;
  familyAccess?: boolean;
  aiAccess?: boolean;
}

export interface CreateManagedUserInput extends AreaAccessInput {
  displayName: string;
  email?: string | null;
  password?: string | null;
  isOwner?: boolean;
  status?: "invited" | "active" | "disabled";
  actorUserId: string;
}

export interface UpdateManagedUserInput extends AreaAccessInput {
  displayName?: string;
  email?: string | null;
  isOwner?: boolean;
  status?: "invited" | "active" | "disabled";
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

export type ChangePasswordResult =
  | "ok"
  | "invalid_current"
  | "no_password"
  | "not_found"
  | "initial_password_required";

export interface SetInitialPasswordInput {
  userId: string;
  newPassword: string;
  keepSessionToken?: string | null;
}

export interface InviteUserResult {
  user: SafeUser;
  inviteToken: string;
  expiresAt: Date;
}

export class UserService {
  constructor(private readonly db: PrismaClient) {}

  async listUsersForAdmin(): Promise<AdminUserView[]> {
    const users = await this.db.user.findMany({
      orderBy: [{ displayName: "asc" }],
      select: {
        ...USER_SAFE_SELECT,
        worldMemberships: {
          include: {
            world: { select: { id: true, name: true, slug: true } },
          },
          orderBy: [{ world: { name: "asc" } }],
        },
      },
    });

    return users.map((user) => ({
      ...toSafeUser(user as Record<string, unknown>),
      worldMemberships: user.worldMemberships.map((membership) => ({
        id: membership.id,
        worldId: membership.worldId,
        characterName: membership.characterName,
        world: membership.world,
      })),
    }));
  }

  async getUserForAdmin(userId: string): Promise<AdminUserView | null> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        ...USER_SAFE_SELECT,
        worldMemberships: {
          include: {
            world: { select: { id: true, name: true, slug: true } },
          },
          orderBy: [{ world: { name: "asc" } }],
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      ...toSafeUser(user as Record<string, unknown>),
      worldMemberships: user.worldMemberships.map((membership) => ({
        id: membership.id,
        worldId: membership.worldId,
        characterName: membership.characterName,
        world: membership.world,
      })),
    };
  }

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
        isOwner: input.isOwner ?? false,
        portalAccess: input.portalAccess ?? false,
        studioAccess: input.studioAccess ?? false,
        brainAccess: input.brainAccess ?? false,
        familyAccess: input.familyAccess ?? false,
        aiAccess: input.aiAccess ?? false,
        status: input.status ?? "active",
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
        isOwner: user.isOwner,
        access: toAreaAccess(user),
      },
    });

    return toSafeUser(user);
  }

  async updateUser(
    userId: string,
    input: UpdateManagedUserInput,
    actorUserId?: string | null,
  ): Promise<SafeUser | null> {
    const existing = await this.db.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return null;
    }

    if (input.email !== undefined && input.email !== existing.email) {
      if (input.email) {
        const duplicate = await this.db.user.findUnique({
          where: { email: input.email.trim().toLowerCase() },
        });
        if (duplicate && duplicate.id !== userId) {
          throw new Error("EMAIL_ALREADY_EXISTS");
        }
      }
    }

    if (input.isOwner === false && existing.isOwner) {
      const ownerCount = await this.db.user.count({
        where: { isOwner: true, status: "active", id: { not: userId } },
      });
      if (ownerCount === 0) {
        throw new Error("LAST_OWNER_ROLE");
      }
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email?.trim().toLowerCase() ?? null } : {}),
        ...(input.isOwner !== undefined ? { isOwner: input.isOwner } : {}),
        ...(input.portalAccess !== undefined ? { portalAccess: input.portalAccess } : {}),
        ...(input.studioAccess !== undefined ? { studioAccess: input.studioAccess } : {}),
        ...(input.brainAccess !== undefined ? { brainAccess: input.brainAccess } : {}),
        ...(input.familyAccess !== undefined ? { familyAccess: input.familyAccess } : {}),
        ...(input.aiAccess !== undefined ? { aiAccess: input.aiAccess } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.forcePasswordChange !== undefined
          ? { forcePasswordChange: input.forcePasswordChange }
          : {}),
      },
      select: USER_SAFE_SELECT,
    });

    if (hasAccessChanged(existing, updated)) {
      await logAuditEvent(this.db, {
        actorUserId: actorUserId ?? undefined,
        action: "user_access_changed",
        targetType: "user",
        targetId: userId,
        metadata: {
          from: { isOwner: existing.isOwner, access: toAreaAccess(existing) },
          to: { isOwner: updated.isOwner, access: toAreaAccess(updated) },
        },
      });
    }

    return toSafeUser(updated);
  }

  async disableUser(userId: string, actorUserId?: string | null): Promise<boolean> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (user.status === "disabled") {
      return true;
    }

    if (user.isOwner) {
      const activeOwners = await this.db.user.count({
        where: { isOwner: true, status: "active", id: { not: userId } },
      });
      if (activeOwners === 0) {
        throw new Error("LAST_OWNER");
      }
    }

    if (actorUserId && actorUserId === userId) {
      throw new Error("CANNOT_DISABLE_SELF");
    }

    await this.db.$transaction([
      this.db.session.deleteMany({ where: { userId } }),
      this.db.user.update({
        where: { id: userId },
        data: { status: "disabled" },
      }),
    ]);

    await logAuditEvent(this.db, {
      actorUserId: actorUserId ?? undefined,
      action: "user_disabled",
      targetType: "user",
      targetId: userId,
      metadata: {
        displayName: user.displayName,
        email: user.email,
      },
    });

    return true;
  }

  async deleteUser(userId: string, actorUserId?: string | null): Promise<boolean> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (actorUserId && actorUserId === userId) {
      throw new Error("CANNOT_DELETE_SELF");
    }

    if (user.isOwner) {
      const activeOwners = await this.db.user.count({
        where: { isOwner: true, status: "active", id: { not: userId } },
      });
      if (activeOwners === 0) {
        throw new Error("LAST_OWNER");
      }
    }

    await this.db.user.delete({ where: { id: userId } });

    await logAuditEvent(this.db, {
      actorUserId: actorUserId ?? undefined,
      action: "user_deleted",
      targetType: "user",
      targetId: userId,
      metadata: {
        displayName: user.displayName,
        email: user.email,
        isOwner: user.isOwner,
        access: toAreaAccess(user),
      },
    });

    return true;
  }

  async enableUser(userId: string, actorUserId?: string | null): Promise<boolean> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (user.status === "active") {
      return true;
    }

    await this.db.user.update({
      where: { id: userId },
      data: { status: "active" },
    });

    await logAuditEvent(this.db, {
      actorUserId: actorUserId ?? undefined,
      action: "user_enabled",
      targetType: "user",
      targetId: userId,
      metadata: {
        displayName: user.displayName,
        email: user.email,
      },
    });

    return true;
  }

  async upsertWorldMembership(input: {
    userId: string;
    worldId: string;
    characterName?: string | null;
  }) {
    return this.db.worldMembership.upsert({
      where: {
        userId_worldId: {
          userId: input.userId,
          worldId: input.worldId,
        },
      },
      create: {
        userId: input.userId,
        worldId: input.worldId,
        characterName: input.characterName ?? null,
      },
      update: {
        characterName: input.characterName !== undefined ? input.characterName : undefined,
      },
      include: {
        world: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async removeWorldMembership(userId: string, worldId: string) {
    const existing = await this.db.worldMembership.findUnique({
      where: { userId_worldId: { userId, worldId } },
    });

    if (!existing) {
      throw new Error("MEMBERSHIP_NOT_FOUND");
    }

    await this.db.worldMembership.delete({
      where: { userId_worldId: { userId, worldId } },
    });
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
      return "initial_password_required";
    }

    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      return "invalid_current";
    }

    return this.applyPasswordChange(user.id, user.displayName, input.newPassword, input.keepSessionToken);
  }

  async setInitialPassword(input: SetInitialPasswordInput): Promise<ChangePasswordResult> {
    const user = await this.db.user.findUnique({ where: { id: input.userId } });
    if (!user) {
      return "not_found";
    }

    if (user.passwordHash) {
      return "no_password";
    }

    return this.applyPasswordChange(
      user.id,
      user.displayName,
      input.newPassword,
      input.keepSessionToken,
    );
  }

  private async applyPasswordChange(
    userId: string,
    displayName: string,
    newPassword: string,
    keepSessionToken?: string | null,
  ): Promise<ChangePasswordResult> {
    const passwordHash = await hashPassword(newPassword);

    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          forcePasswordChange: false,
          resetTokenHash: null,
          resetTokenExpiresAt: null,
        },
      }),
      keepSessionToken
        ? this.db.session.deleteMany({
            where: {
              userId,
              NOT: { tokenHash: hashOpaqueToken(keepSessionToken) },
            },
          })
        : this.db.session.deleteMany({ where: { userId } }),
    ]);

    await logAuditEvent(this.db, {
      actorUserId: userId,
      action: "password_changed",
      targetType: "user",
      targetId: userId,
      metadata: {
        displayName,
        method: "self_service",
      },
    });

    return "ok";
  }

  async createInvite(input: CreateInviteInput): Promise<InviteUserResult> {
    return createInvite(this.db, input);
  }

  async acceptInvite(input: {
    email: string;
    inviteToken: string;
    password: string;
  }): Promise<SafeUser | null> {
    return acceptInvite(this.db, input);
  }

  async createPasswordResetToken(input: {
    email: string;
    expiresAt?: Date;
  }): Promise<{ resetToken: string; expiresAt: Date } | null> {
    return createPasswordResetToken(this.db, input);
  }

  async resetPasswordWithToken(input: {
    email: string;
    resetToken: string;
    newPassword: string;
  }): Promise<boolean> {
    return resetPasswordWithToken(this.db, input);
  }

  /** Internal auth lookup — never expose the returned record via API. */
  async findUserForAuthentication(email: string) {
    return this.db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }
}

export function createUserService(db: PrismaClient): UserService {
  return new UserService(db);
}

interface AccessSnapshot {
  isOwner: boolean;
  portalAccess: boolean;
  studioAccess: boolean;
  brainAccess: boolean;
  familyAccess: boolean;
  aiAccess: boolean;
}

function hasAccessChanged(before: AccessSnapshot, after: AccessSnapshot): boolean {
  const from = toAreaAccess(before);
  const to = toAreaAccess(after);
  return (
    before.isOwner !== after.isOwner ||
    // Das KI-Flag gehört ins Audit wie die Häkchen: „wer darf den RTX-Host
    // beschäftigen" ist eine Rechteänderung, keine Einstellung.
    before.aiAccess !== after.aiAccess ||
    (Object.keys(from) as Array<keyof AreaAccess>).some((area) => from[area] !== to[area])
  );
}
