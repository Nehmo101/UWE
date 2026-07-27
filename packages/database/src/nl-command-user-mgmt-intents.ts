import { randomBytes } from "node:crypto";
import { toAreaAccess } from "@uwe/auth";
import type { PrismaClient } from "./client";
import { logAuditEvent } from "./audit-log-service";
import {
  formatEntityResolveError,
  resolveUserQuery,
  resolveWorldQuery,
} from "./nl-command-entity-resolver";
import type {
  NlCommandExecutionContext,
  NlCommandExecutionResult,
  NlCommandIntent,
} from "./nl-command-service";
import { createUserService } from "./user-service";
import {
  extractUserQuery,
  extractWorldQuery,
  matchesAny,
} from "./nl-command-text-helpers";

function generateTemporaryPassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i]! % chars.length]!;
  }
  return password;
}

async function logNlCommandAudit(
  db: PrismaClient,
  ctx: NlCommandExecutionContext,
  intent: NlCommandIntent,
  summary: string,
  extraMetadata?: Record<string, unknown>,
): Promise<void> {
  const isMutation =
    intent.intent === "delete_user" || intent.intent === "reset_password";
  const targetType =
    intent.intent === "list_world_members"
      ? "world"
      : intent.intent === "delete_user" || intent.intent === "reset_password"
        ? "user"
        : "system";
  const targetId =
    typeof extraMetadata?.userId === "string"
      ? extraMetadata.userId
      : intent.intent === "list_world_members" &&
          typeof extraMetadata?.worldId === "string"
        ? extraMetadata.worldId
        : undefined;
  await logAuditEvent(db, {
    actorUserId: ctx.actorUserId,
    action: "content_updated",
    targetType,
    targetId,
    request: ctx.request,
    metadata: {
      source: "nl_command",
      intent: intent.intent,
      readOnly: !isMutation,
      summary,
      ...extraMetadata,
    },
  });
}

export function parseListWorldMembersIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(list|liste|zeige|show)\b.*\b(mitglieder|members|spieler|membership)\b/,
    /\b(mitglieder|members)\b.*\b(liste|list|anzeigen|zeige|show)\b/,
    /\b(weltmitglieder|world members)\b/,
  ];
  if (!matchesAny(text, patterns)) {
    return null;
  }

  const worldQuery = extractWorldQuery(text);
  if (!worldQuery) {
    return null;
  }

  return { intent: "list_world_members", worldQuery };
}

export function parseDeleteUserIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(lösche|loesche|delete|entferne)\b.*\b(benutzer|user|nutzer|account)\b/,
    /\b(benutzer|user|nutzer|account)\b.*\b(löschen|loeschen|delete|entfernen)\b/,
    /\bdelete user\b/,
  ];
  if (!matchesAny(text, patterns)) {
    return null;
  }

  if (extractWorldQuery(text) && /\b(aus|from)\b/.test(text)) {
    return null;
  }

  const explicit = text.match(
    /\b(?:lösche|loesche|delete|entferne)\s+(?:benutzer|user|nutzer|account)\s+([a-zäöüß0-9._@-]+)/i,
  );
  const userQuery = explicit?.[1]?.trim() || extractUserQuery(text);
  if (!userQuery || userQuery === "user" || userQuery === "benutzer") {
    return null;
  }

  return { intent: "delete_user", userQuery };
}

export function parseResetPasswordIntent(text: string): NlCommandIntent | null {
  const patterns = [
    /\b(passwort|password)\b.*\b(zurücksetzen|zuruecksetzen|reset|erneuern|neu)\b/,
    /\b(reset|zurücksetzen|zuruecksetzen)\b.*\b(passwort|password)\b/,
    /\breset password\b/,
  ];
  if (!matchesAny(text, patterns)) {
    return null;
  }

  const forUser = text.match(/\b(?:für|for)\s+([a-zäöüß0-9._-]+)/i);
  const userQuery = forUser?.[1]?.trim() || extractUserQuery(text);
  if (!userQuery) {
    return null;
  }

  return { intent: "reset_password", userQuery };
}

export async function executeListWorldMembersIntent(
  db: PrismaClient,
  ctx: NlCommandExecutionContext,
  intent: Extract<NlCommandIntent, { intent: "list_world_members" }>,
): Promise<NlCommandExecutionResult> {
  const worldResult = await resolveWorldQuery(db, intent.worldQuery);
  if (!worldResult.ok) {
    return {
      ok: false,
      error: formatEntityResolveError("Welt", worldResult),
      code: worldResult.code === "ambiguous" ? "ambiguous" : "invalid",
    };
  }

  const memberships = await db.worldMembership.findMany({
    where: { worldId: worldResult.entity.id },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          isOwner: true,
          portalAccess: true,
          studioAccess: true,
          brainAccess: true,
          familyAccess: true,
          status: true,
        },
      },
    },
    orderBy: [{ user: { displayName: "asc" } }],
  });

  const summary = `${memberships.length} Mitglieder in „${worldResult.entity.name}“.`;
  await logNlCommandAudit(db, ctx, intent, summary, {
    worldId: worldResult.entity.id,
    count: memberships.length,
  });
  return {
    ok: true,
    intent: intent.intent,
    summary,
    data: memberships.map((membership) => ({
      userId: membership.user.id,
      displayName: membership.user.displayName,
      email: membership.user.email,
      isOwner: membership.user.isOwner,
      access: toAreaAccess(membership.user),
      status: membership.user.status,
      characterName: membership.characterName,
    })),
  };
}

export async function executeDeleteUserIntent(
  db: PrismaClient,
  ctx: NlCommandExecutionContext,
  intent: Extract<NlCommandIntent, { intent: "delete_user" }>,
): Promise<NlCommandExecutionResult> {
  const userResult = await resolveUserQuery(db, intent.userQuery);
  if (!userResult.ok) {
    return {
      ok: false,
      error: formatEntityResolveError("Benutzer", userResult),
      code: userResult.code === "ambiguous" ? "ambiguous" : "invalid",
    };
  }

  try {
    await createUserService(db).deleteUser(userResult.entity.id, ctx.actorUserId);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CANNOT_DELETE_SELF") {
        return { ok: false, error: "Du kannst deinen eigenen Account nicht löschen.", code: "forbidden" };
      }
      if (error.message === "LAST_OWNER") {
        return { ok: false, error: "Der letzte aktive Owner kann nicht gelöscht werden.", code: "forbidden" };
      }
    }
    throw error;
  }

  const summary = `Benutzer „${userResult.entity.displayName}“ wurde gelöscht.`;
  await logNlCommandAudit(db, ctx, intent, summary, {
    userId: userResult.entity.id,
  });
  return {
    ok: true,
    intent: intent.intent,
    summary,
    data: { userId: userResult.entity.id, displayName: userResult.entity.displayName },
  };
}

export async function executeResetPasswordIntent(
  db: PrismaClient,
  ctx: NlCommandExecutionContext,
  intent: Extract<NlCommandIntent, { intent: "reset_password" }>,
): Promise<NlCommandExecutionResult> {
  const userResult = await resolveUserQuery(db, intent.userQuery);
  if (!userResult.ok) {
    return {
      ok: false,
      error: formatEntityResolveError("Benutzer", userResult),
      code: userResult.code === "ambiguous" ? "ambiguous" : "invalid",
    };
  }

  const tempPassword = generateTemporaryPassword();
  const userService = createUserService(db);
  const ok = await userService.resetPassword({
    userId: userResult.entity.id,
    newPassword: tempPassword,
    actorUserId: ctx.actorUserId,
    forcePasswordChange: true,
  });
  if (!ok) {
    return { ok: false, error: "Benutzer nicht gefunden.", code: "invalid" };
  }

  const summary = `Passwort für „${userResult.entity.displayName}“ wurde zurückgesetzt.`;
  await logNlCommandAudit(db, ctx, intent, summary, {
    userId: userResult.entity.id,
  });
  return {
    ok: true,
    intent: intent.intent,
    summary,
    data: {
      userId: userResult.entity.id,
      displayName: userResult.entity.displayName,
      temporaryPassword: tempPassword,
      forcePasswordChange: true,
    },
  };
}
