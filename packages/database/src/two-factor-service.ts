import {
  buildTotpAuthUri,
  generateOpaqueToken,
  generateTotpSecret,
  hashOpaqueToken,
  verifyTotpCode,
} from "@uwe/auth/server";
import type { PrismaClient } from "./client";
import { decryptSecret, encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";

const CHALLENGE_TTL_MS = 5 * 60_000;

/**
 * Wrong TOTP codes allowed per challenge before it is burned. Without this the
 * 5-minute TTL lets an attacker try unlimited codes against a single challenge
 * (the IP rate limit is the only other gate and is itself spoofable). Five
 * attempts keeps a fat-fingered code recoverable while making brute force of a
 * 6-digit TOTP within one challenge hopeless.
 */
export const MAX_CHALLENGE_ATTEMPTS = 5;

export interface TwoFactorSetupStart {
  secret: string;
  otpauthUri: string;
}

export interface TwoFactorLoginChallenge {
  challengeToken: string;
  expiresAt: Date;
}

export class TwoFactorService {
  constructor(private readonly db: PrismaClient) {}

  async isEnabled(userId: string): Promise<boolean> {
    const record = await this.db.twoFactorSecret.findUnique({
      where: { userId },
      select: { isEnabled: true },
    });
    return record?.isEnabled === true;
  }

  async beginSetup(userId: string, accountName: string): Promise<TwoFactorSetupStart> {
    const secret = generateTotpSecret();
    const encryptionSecret = resolveTokenEncryptionSecret();

    await this.db.twoFactorSecret.upsert({
      where: { userId },
      create: {
        userId,
        secretEncrypted: encryptSecret(secret, encryptionSecret),
        isEnabled: false,
      },
      update: {
        secretEncrypted: encryptSecret(secret, encryptionSecret),
        isEnabled: false,
        backupCodesHash: null,
      },
    });

    return {
      secret,
      otpauthUri: buildTotpAuthUri(secret, { issuer: "UWE", accountName }),
    };
  }

  async confirmSetup(userId: string, code: string): Promise<boolean> {
    const record = await this.db.twoFactorSecret.findUnique({ where: { userId } });
    if (!record) {
      return false;
    }

    const secret = decryptSecret(record.secretEncrypted, resolveTokenEncryptionSecret());
    if (!verifyTotpCode(secret, code)) {
      return false;
    }

    await this.db.twoFactorSecret.update({
      where: { userId },
      data: { isEnabled: true },
    });

    return true;
  }

  async disable(userId: string): Promise<void> {
    // Secret und offene Challenges gemeinsam entfernen, damit bei einem Fehler
    // zwischen den beiden Löschungen keine verwaisten Challenges zurückbleiben.
    await this.db.$transaction([
      this.db.twoFactorSecret.deleteMany({ where: { userId } }),
      this.db.twoFactorChallenge.deleteMany({ where: { userId } }),
    ]);
  }

  async createLoginChallenge(userId: string): Promise<TwoFactorLoginChallenge> {
    const challengeToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

    // Burn any still-open challenges for this user first. Otherwise an attacker
    // who knows the password could loop "password login → fresh challenge" to
    // reset the per-challenge attempt budget indefinitely.
    await this.db.twoFactorChallenge.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await this.db.twoFactorChallenge.create({
      data: {
        userId,
        challengeTokenHash: hashOpaqueToken(challengeToken),
        expiresAt,
      },
    });

    return { challengeToken, expiresAt };
  }

  async verifyLoginChallenge(
    challengeToken: string,
    code: string,
  ): Promise<{ userId: string } | null> {
    const challengeTokenHash = hashOpaqueToken(challengeToken);
    const challenge = await this.db.twoFactorChallenge.findUnique({
      where: { challengeTokenHash },
      include: {
        user: {
          select: { id: true, status: true },
        },
      },
    });

    if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date()) {
      return null;
    }

    if (challenge.user.status !== "active") {
      return null;
    }

    const secretRecord = await this.db.twoFactorSecret.findUnique({
      where: { userId: challenge.userId },
    });

    if (!secretRecord?.isEnabled) {
      return null;
    }

    const secret = decryptSecret(secretRecord.secretEncrypted, resolveTokenEncryptionSecret());
    if (!verifyTotpCode(secret, code)) {
      // Count the failure and burn the challenge once the budget is spent, so
      // the 5-minute TTL is not an unlimited TOTP guessing window.
      const nextAttemptCount = challenge.attemptCount + 1;
      await this.db.twoFactorChallenge.update({
        where: { id: challenge.id },
        data: {
          attemptCount: nextAttemptCount,
          ...(nextAttemptCount >= MAX_CHALLENGE_ATTEMPTS ? { consumedAt: new Date() } : {}),
        },
      });
      return null;
    }

    await this.db.twoFactorChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    return { userId: challenge.userId };
  }
}

export function createTwoFactorService(db: PrismaClient): TwoFactorService {
  return new TwoFactorService(db);
}
