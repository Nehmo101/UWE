import {
  API_TOKEN_SCOPES,
  type ApiTokenScope,
} from "@uwe/auth";
import { createApiTokenService, type PrismaClient } from "@uwe/database/server";

/**
 * API tokens and webhooks from the Command Center — replaces Studio
 * `/admin/api-tokens` and `/admin/webhooks` (Abschnitt D).
 *
 * A token's plaintext value is returned exactly once, on creation, like in the
 * Studio UI it replaces. Everything else is metadata.
 */

function parseScopes(input: unknown): ApiTokenScope[] {
  if (!Array.isArray(input)) {
    throw new Error("scopes muss eine Liste sein.");
  }
  const scopes = input.map(String);
  const unknown = scopes.filter(
    (scope) => !(API_TOKEN_SCOPES as readonly string[]).includes(scope),
  );
  if (unknown.length > 0) {
    throw new Error(`Unbekannte Scopes: ${unknown.join(", ")}`);
  }
  return scopes as ApiTokenScope[];
}

/** Resolves the account a token acts for: the owner unless told otherwise. */
async function resolveTokenOwner(
  db: PrismaClient,
  userId?: string,
): Promise<{ id: string; isOwner: boolean }> {
  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isOwner: true },
    });
    if (!user) throw new Error("Benutzer nicht gefunden.");
    return user;
  }

  const owner = await db.user.findFirst({
    where: { isOwner: true, status: "active" },
    select: { id: true, isOwner: true },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) throw new Error("Kein aktiver Owner vorhanden.");
  return owner;
}

export async function listApiTokens(db: PrismaClient, userId?: string): Promise<unknown> {
  const owner = await resolveTokenOwner(db, userId);
  const tokens = await createApiTokenService(db).listForUser(owner.id);
  return { userId: owner.id, tokens, availableScopes: API_TOKEN_SCOPES };
}

export interface CreateApiTokenBody {
  name?: string;
  scopes?: unknown;
  userId?: string;
  expiresAt?: string;
}

export async function createApiToken(
  db: PrismaClient,
  body: CreateApiTokenBody,
): Promise<unknown> {
  const name = body.name?.trim();
  if (!name) throw new Error("Name ist erforderlich.");

  const owner = await resolveTokenOwner(db, body.userId);
  const created = await createApiTokenService(db).create({
    userId: owner.id,
    isOwner: owner.isOwner,
    name,
    scopes: parseScopes(body.scopes ?? []),
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
  });

  return created;
}

export async function revokeApiToken(
  db: PrismaClient,
  body: { id?: string; userId?: string },
): Promise<unknown> {
  if (!body.id) throw new Error("Token-ID ist erforderlich.");
  const owner = await resolveTokenOwner(db, body.userId);
  await createApiTokenService(db).revoke(body.id, owner.id);
  return { revokedId: body.id };
}
