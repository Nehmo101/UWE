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
    await this.db.twoFactorSecret.deleteMany({ where: { userId } });
    await this.db.twoFactorChallenge.deleteMany({ where: { userId } });
  }

  async createLoginChallenge(userId: string): Promise<TwoFactorLoginChallenge> {
    const challengeToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

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
