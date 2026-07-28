import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@uwe/auth";
import { createAuthService } from "@uwe/database/server";
import type { PrismaClient } from "@uwe/database/server";

export interface SecurityDashboardAccess {
  allowed: boolean;
  isOwner: boolean;
  displayName: string | null;
  reason: string;
}

export async function resolveSecurityDashboardAccess(
  db: PrismaClient,
): Promise<SecurityDashboardAccess> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return {
      allowed: false,
      isOwner: false,
      displayName: null,
      reason: "Kein Portal-Login — nur der Owner mit gültiger Session.",
    };
  }

  const auth = createAuthService(db);
  const session = await auth.getSessionByToken(token);

  if (!session) {
    return {
      allowed: false,
      isOwner: false,
      displayName: null,
      reason: "Session abgelaufen oder ungültig — bitte im Portal anmelden.",
    };
  }

  if (!session.user.isOwner) {
    return {
      allowed: false,
      isOwner: false,
      displayName: session.user.displayName,
      reason: "Kein Zugriff — das Sicherheits-Dashboard ist owner-only.",
    };
  }

  return {
    allowed: true,
    isOwner: true,
    displayName: session.user.displayName,
    reason: "Zugriff erlaubt",
  };
}
