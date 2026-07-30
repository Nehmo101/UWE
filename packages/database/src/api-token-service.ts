import type { PrismaClient } from "./client";
import type { ApiTokenScopeName } from "./generated/prisma/client";
import {
  assertAdminScopesForOwner,
  getApiTokenPrefix,
  type ApiTokenScope,
} from "@uwe/auth";
import {
  generateApiTokenValue,
  hashApiToken,
  verifyApiTokenHash,
} from "@uwe/auth/server";
import { hashClientIp, logAuditEvent } from "./audit-log-service";
import { resolveClientIp } from "@uwe/auth";

export interface ApiTokenView {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: ApiTokenScope[];
  isActive: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  userId: string;
}

export interface CreateApiTokenInput {
  userId: string;
  /** Whether the creating/owning account is the owner (admin scopes need it). */
  isOwner: boolean;
  name: string;
  scopes: ApiTokenScope[];
  expiresAt?: Date | null;
}

export interface CreateApiTokenResult {
  token: ApiTokenView;
  /** Plaintext token — shown once, never stored or logged. */
  plaintextToken: string;
}

export interface ResolvedApiToken {
  id: string;
  userId: string;
  /** Whether the creating/owning account is the owner (admin scopes need it). */
  isOwner: boolean;
  /**
   * Whether the owning account may use the RTX AI (G-KI).
   *
   * Reist mit, damit ein Token kein Schleichweg wird: wer die KI selbst nicht
   * benutzen darf, darf sie auch nicht über ein Token benutzen, das er sich
   * ausstellt. Die Scopes regeln, WAS ein Token darf — dieses Feld regelt, was
   * sein Besitzer überhaupt dürfte.
   */
  aiAccess: boolean;
  scopes: ApiTokenScope[];
  name: string;
}

const SCOPE_NAME_MAP: Record<ApiTokenScope, ApiTokenScopeName> = {
  health_read: "health_read",
  worlds_read: "worlds_read",
  export_read: "export_read",
  webhooks_manage: "webhooks_manage",
  ai_invoke: "ai_invoke",
  mail_read: "mail_read",
  mail_send: "mail_send",
  settings_read: "settings_read",
  settings_write: "settings_write",
  admin_read: "admin_read",
  admin_write: "admin_write",
  backup_read: "backup_read",
  backup_write: "backup_write",
  family_read: "family_read",
  family_write: "family_write",
  family_calendar: "family_calendar",
};

function toScopeName(scope: ApiTokenScope): ApiTokenScopeName {
  return SCOPE_NAME_MAP[scope];
}

function fromScopeName(scope: ApiTokenScopeName): ApiTokenScope {
  return scope as ApiTokenScope;
}

export class ApiTokenService {
  constructor(private readonly db: PrismaClient) {}

  async listForUser(userId: string): Promise<ApiTokenView[]> {
    const tokens = await this.db.apiToken.findMany({
      where: { userId },
      include: { scopes: true },
      orderBy: { createdAt: "desc" },
    });

    return tokens.map((token) => this.toView(token));
  }

  async create(input: CreateApiTokenInput): Promise<CreateApiTokenResult> {
    assertAdminScopesForOwner(input.isOwner, input.scopes);

    const plaintextToken = generateApiTokenValue();
    const tokenHash = hashApiToken(plaintextToken);
    const tokenPrefix = getApiTokenPrefix(plaintextToken);

    const created = await this.db.apiToken.create({
      data: {
        userId: input.userId,
        name: input.name.trim(),
        tokenHash,
        tokenPrefix,
        expiresAt: input.expiresAt ?? null,
        scopes: {
          create: input.scopes.map((scope) => ({ scope: toScopeName(scope) })),
        },
      },
      include: { scopes: true },
    });

    await logAuditEvent(this.db, {
      actorUserId: input.userId,
      action: "api_token_created",
      targetType: "api_token",
      targetId: created.id,
      metadata: { name: input.name, scopes: input.scopes, tokenPrefix },
    });

    return {
      token: this.toView(created),
      plaintextToken,
    };
  }

  async revoke(tokenId: string, actorUserId: string): Promise<void> {
    await this.db.apiToken.update({
      where: { id: tokenId },
      data: { isActive: false },
    });

    await logAuditEvent(this.db, {
      actorUserId,
      action: "api_token_revoked",
      targetType: "api_token",
      targetId: tokenId,
    });
  }

  async rotate(
    tokenId: string,
    actorUserId: string,
    isOwner: boolean,
  ): Promise<CreateApiTokenResult> {
    const existing = await this.db.apiToken.findUnique({
      where: { id: tokenId },
      include: { scopes: true },
    });
    if (!existing || !existing.isActive) {
      throw new Error("Token not found or inactive.");
    }

    const scopes = existing.scopes.map((entry) => fromScopeName(entry.scope));
    const created = await this.create({
      userId: existing.userId,
      isOwner,
      name: `${existing.name} (rotiert)`,
      scopes,
      expiresAt: existing.expiresAt,
    });

    await this.db.apiToken.update({
      where: { id: tokenId },
      data: { isActive: false },
    });

    await this.db.apiToken.update({
      where: { id: created.token.id },
      data: { rotatedFromId: tokenId },
    });

    await logAuditEvent(this.db, {
      actorUserId,
      action: "api_token_rotated",
      targetType: "api_token",
      targetId: tokenId,
      metadata: { newTokenId: created.token.id },
    });

    return created;
  }

  async resolveFromBearer(
    bearerToken: string,
    headers?: Headers,
  ): Promise<ResolvedApiToken | null> {
    const tokenHash = hashApiToken(bearerToken);
    const record = await this.db.apiToken.findUnique({
      where: { tokenHash },
      include: { scopes: true, user: true },
    });

    if (!record || !record.isActive) {
      return null;
    }

    if (!verifyApiTokenHash(bearerToken, record.tokenHash)) {
      return null;
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      return null;
    }

    await this.db.apiToken.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    if (headers) {
      await this.db.apiTokenUsageLog.create({
        data: {
          tokenId: record.id,
          route: headers.get("x-uwe-route") ?? "unknown",
          method: headers.get("x-uwe-method") ?? "unknown",
          statusCode: 200,
          ipHash: hashClientIp(resolveClientIp(headers)),
        },
      });
    }

    return {
      id: record.id,
      userId: record.userId,
      isOwner: record.user.isOwner,
      aiAccess: record.user.aiAccess,
      scopes: record.scopes.map((entry) => fromScopeName(entry.scope)),
      name: record.name,
    };
  }

  private toView(
    token: {
      id: string;
      userId: string;
      name: string;
      tokenPrefix: string;
      isActive: boolean;
      expiresAt: Date | null;
      lastUsedAt: Date | null;
      createdAt: Date;
      scopes: Array<{ scope: ApiTokenScopeName }>;
    },
  ): ApiTokenView {
    return {
      id: token.id,
      userId: token.userId,
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      scopes: token.scopes.map((entry) => fromScopeName(entry.scope)),
      isActive: token.isActive,
      expiresAt: token.expiresAt,
      lastUsedAt: token.lastUsedAt,
      createdAt: token.createdAt,
    };
  }
}

export function createApiTokenService(db: PrismaClient): ApiTokenService {
  return new ApiTokenService(db);
}
