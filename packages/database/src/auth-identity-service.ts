import type { PrismaClient } from "./client";

/**
 * Data access for external login identities (`auth_identities`), currently
 * used by "Mit Google anmelden". An identity binds a provider's stable user id
 * (Google: the `sub` claim) to a UWE user; the stored e-mail is diagnostics
 * only and never used for matching after the initial link.
 *
 * UWE stays invite-only: this service never creates users. Login policy
 * (verified-e-mail auto-link, unknown-e-mail rejection) lives in
 * `@uwe/auth`'s Google login flow — this class is persistence only.
 */

export interface AuthIdentityWithUser {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  user: {
    id: string;
    displayName: string;
    email: string | null;
    isOwner: boolean;
    portalAccess: boolean;
    studioAccess: boolean;
    brainAccess: boolean;
    familyAccess: boolean;
    status: "invited" | "active" | "disabled";
    forcePasswordChange: boolean;
  };
}

export interface AuthIdentityView {
  provider: string;
  email: string | null;
  createdAt: Date;
}

export interface ActiveUserForOAuthLink {
  id: string;
  displayName: string;
  email: string | null;
  isOwner: boolean;
    portalAccess: boolean;
    studioAccess: boolean;
    brainAccess: boolean;
    familyAccess: boolean;
  status: "invited" | "active" | "disabled";
  forcePasswordChange: boolean;
}

const USER_SELECT = {
  id: true,
  displayName: true,
  email: true,
  isOwner: true,
  portalAccess: true,
  studioAccess: true,
  brainAccess: true,
  familyAccess: true,
  status: true,
  forcePasswordChange: true,
} as const;

export class AuthIdentityService {
  constructor(private readonly db: PrismaClient) {}

  async findByProvider(
    provider: string,
    providerUserId: string,
  ): Promise<AuthIdentityWithUser | null> {
    const record = await this.db.authIdentity.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { user: { select: USER_SELECT } },
    });
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      userId: record.userId,
      provider: record.provider,
      providerUserId: record.providerUserId,
      user: record.user,
    };
  }

  /** Active user for a lowercased e-mail — the verified-e-mail auto-link path. */
  async findActiveUserByVerifiedEmail(email: string): Promise<ActiveUserForOAuthLink | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    const user = await this.db.user.findUnique({
      where: { email: normalized },
      select: USER_SELECT,
    });
    return user && user.status === "active" ? user : null;
  }

  /**
   * Links a provider identity to a user (upsert on the provider+providerUserId
   * unique key). Returns `{ conflict: true }` when the identity already belongs
   * to a DIFFERENT user — the caller must reject instead of stealing the link.
   */
  async linkIdentity(input: {
    userId: string;
    provider: string;
    providerUserId: string;
    email?: string | null;
  }): Promise<{ conflict: boolean }> {
    const existing = await this.db.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: input.provider,
          providerUserId: input.providerUserId,
        },
      },
      select: { id: true, userId: true },
    });

    if (existing && existing.userId !== input.userId) {
      return { conflict: true };
    }

    if (existing) {
      await this.db.authIdentity.update({
        where: { id: existing.id },
        data: { email: input.email ?? null },
      });
      return { conflict: false };
    }

    await this.db.authIdentity.create({
      data: {
        userId: input.userId,
        provider: input.provider,
        providerUserId: input.providerUserId,
        email: input.email ?? null,
      },
    });
    return { conflict: false };
  }

  /** Removes a user's identity for a provider. Returns whether one was removed. */
  async unlinkForUser(userId: string, provider: string): Promise<boolean> {
    const result = await this.db.authIdentity.deleteMany({
      where: { userId, provider },
    });
    return result.count > 0;
  }

  async listForUser(userId: string): Promise<AuthIdentityView[]> {
    return this.db.authIdentity.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { provider: true, email: true, createdAt: true },
    });
  }

  /**
   * Whether the user still has another way to sign in besides the given
   * provider (password or passkey). Used as the unlink lockout guard.
   */
  async hasAlternativeLoginMethod(userId: string): Promise<boolean> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (user?.passwordHash) {
      return true;
    }
    const passkeys = await this.db.webAuthnCredential.count({ where: { userId } });
    return passkeys > 0;
  }
}

export function createAuthIdentityService(db: PrismaClient): AuthIdentityService {
  return new AuthIdentityService(db);
}
