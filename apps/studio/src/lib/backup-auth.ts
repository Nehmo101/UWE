import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { UweRole } from "@uwe/auth";
import { SESSION_COOKIE_NAME } from "@uwe/auth";
import {
  canCreateBackup,
  canDownloadBackup,
  canListBackups,
  canPreviewRestore,
  canRestoreBackup,
} from "@uwe/backup";
import { createAuthService, createPrismaClient } from "@uwe/database/server";

export const BACKUP_ACTOR_ROLE_HEADER = "x-uwe-actor-role";

export type BackupAuthAction = "create" | "download" | "list" | "preview" | "restore";

function mapActorRoleHeader(value: string | null): UweRole | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === "owner") return "owner";
  if (normalized === "admin" || normalized === "dm") return "dm";
  if (normalized === "player") return "player";
  if (normalized === "guest") return "guest";

  return null;
}

async function resolveRoleFromSession(): Promise<UweRole | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }

    const db = createPrismaClient();
    const auth = createAuthService(db);
    const session = await auth.getSessionByToken(token);
    await db.$disconnect();

    return (session?.user.role as UweRole | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the actor role for backup operations.
 * Priority: explicit test/API header → portal session → trusted owner default.
 */
export async function resolveBackupActorRole(request: Request): Promise<UweRole> {
  const headerRole = mapActorRoleHeader(request.headers.get(BACKUP_ACTOR_ROLE_HEADER));
  if (headerRole) {
    return headerRole;
  }

  const sessionRole = await resolveRoleFromSession();
  if (sessionRole) {
    return sessionRole;
  }

  return "owner";
}

function isActionAllowed(action: BackupAuthAction, role: UweRole): boolean {
  switch (action) {
    case "create":
      return canCreateBackup(role);
    case "download":
      return canDownloadBackup(role);
    case "list":
      return canListBackups(role);
    case "preview":
      return canPreviewRestore(role);
    case "restore":
      return canRestoreBackup(role);
    default:
      return false;
  }
}

export async function requireBackupAuth(
  request: Request,
  action: BackupAuthAction,
): Promise<NextResponse | { role: UweRole }> {
  const role = await resolveBackupActorRole(request);

  if (!isActionAllowed(action, role)) {
    return NextResponse.json(
      { error: "Keine Berechtigung für diese Backup-Aktion." },
      { status: 403 },
    );
  }

  return { role };
}
