import { hashOpaqueToken } from "@uwe/auth/server";
import type { PrismaClient } from "./client";

const CHALLENGE_TTL_MS = 5 * 60_000;

export type WebAuthnChallengeType = "registration" | "authentication";

/** Client-safe view of a registered passkey — never exposes the public key. */
export interface PasskeyCredentialView {
  id: string;
  name: string;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface PasskeyCredentialWithUser {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  rpId: string;
  user: {
    id: string;
    displayName: string;
    email: string | null;
    role: "owner" | "admin" | "dm" | "player" | "readonly" | "guest";
    status: "invited" | "active" | "disabled";
    forcePasswordChange: boolean;
  };
}

export interface InsertPasskeyCredentialInput {
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[] | null;
  deviceType?: string | null;
  backedUp?: boolean;
  rpId: string;
  name: string;
}

function parseTransports(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

const CREDENTIAL_VIEW_SELECT = {
  id: true,
  name: true,
  deviceType: true,
  backedUp: true,
  createdAt: true,
  lastUsedAt: true,
} as const;

/**
 * Data access for WebAuthn passkeys: credential CRUD plus the single-use
 * challenge store. Challenges are persisted hashed (like session and 2FA
 * tokens) so a DB leak never yields a replayable value. All WebAuthn
 * verification (signatures, attestation) lives in `@uwe/passkeys` — this
 * class is deliberately persistence-only.
 */
export class PasskeyCredentialStore {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Persists a server-issued challenge (hashed). `userId` is null for
   * usernameless authentication ceremonies. Expired rows are pruned
   * opportunistically so the table cannot grow unbounded.
   */
  async persistChallenge(input: {
    challenge: string;
    type: WebAuthnChallengeType;
    userId?: string | null;
    ttlMs?: number;
  }): Promise<{ expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + (input.ttlMs ?? CHALLENGE_TTL_MS));

    await this.db.webAuthnChallenge.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });

    await this.db.webAuthnChallenge.create({
      data: {
        challengeHash: hashOpaqueToken(input.challenge),
        type: input.type,
        userId: input.userId ?? null,
        expiresAt,
      },
    });

    return { expiresAt };
  }

  /**
   * Consumes a challenge exactly once. Returns the challenge's bound user
   * (null for usernameless login) or `null` when the challenge is unknown,
   * expired, of the wrong type, or already consumed.
   */
  async consumeChallenge(
    challenge: string,
    type: WebAuthnChallengeType,
  ): Promise<{ userId: string | null } | null> {
    const record = await this.db.webAuthnChallenge.findUnique({
      where: { challengeHash: hashOpaqueToken(challenge) },
    });

    if (!record || record.type !== type || record.consumedAt || record.expiresAt <= new Date()) {
      return null;
    }

    await this.db.webAuthnChallenge.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    return { userId: record.userId };
  }

  async insertCredential(input: InsertPasskeyCredentialInput): Promise<PasskeyCredentialView> {
    return this.db.webAuthnCredential.create({
      data: {
        userId: input.userId,
        credentialId: input.credentialId,
        publicKey: input.publicKey,
        counter: input.counter,
        transports: input.transports?.length ? JSON.stringify(input.transports) : null,
        deviceType: input.deviceType ?? null,
        backedUp: input.backedUp ?? false,
        rpId: input.rpId,
        name: input.name,
      },
      select: CREDENTIAL_VIEW_SELECT,
    });
  }

  async listForUser(userId: string): Promise<PasskeyCredentialView[]> {
    return this.db.webAuthnCredential.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: CREDENTIAL_VIEW_SELECT,
    });
  }

  /** Credential IDs already registered for a user (for `excludeCredentials`). */
  async listCredentialIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.db.webAuthnCredential.findMany({
      where: { userId },
      select: { credentialId: true },
    });
    return rows.map((row) => row.credentialId);
  }

  /**
   * Looks up a credential by its WebAuthn credential ID for a login ceremony.
   * Returns `null` for unknown credentials and for inactive users, so a
   * disabled account cannot sign in with a previously registered passkey.
   */
  async findByCredentialIdForLogin(credentialId: string): Promise<PasskeyCredentialWithUser | null> {
    const record = await this.db.webAuthnCredential.findUnique({
      where: { credentialId },
      include: { user: true },
    });

    if (!record || record.user.status !== "active") {
      return null;
    }

    return {
      id: record.id,
      userId: record.userId,
      credentialId: record.credentialId,
      publicKey: record.publicKey,
      counter: record.counter,
      transports: parseTransports(record.transports),
      rpId: record.rpId,
      user: {
        id: record.user.id,
        displayName: record.user.displayName,
        email: record.user.email,
        role: record.user.role,
        status: record.user.status,
        forcePasswordChange: record.user.forcePasswordChange,
      },
    };
  }

  async updateAfterLogin(id: string, counter: number): Promise<void> {
    await this.db.webAuthnCredential.update({
      where: { id },
      data: { counter, lastUsedAt: new Date() },
    });
  }

  /** Deletes a credential scoped to its owner. Returns whether a row was removed. */
  async deleteForUser(userId: string, id: string): Promise<boolean> {
    const result = await this.db.webAuthnCredential.deleteMany({
      where: { id, userId },
    });
    return result.count > 0;
  }

  async countForUser(userId: string): Promise<number> {
    return this.db.webAuthnCredential.count({ where: { userId } });
  }
}

export function createPasskeyCredentialStore(db: PrismaClient): PasskeyCredentialStore {
  return new PasskeyCredentialStore(db);
}
