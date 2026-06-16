import { cookies } from "next/headers";
import {
  canAccessSecurityDashboard,
  SESSION_COOKIE_NAME,
} from "@uwe/auth";
import { createAuthService } from "@uwe/database/server";
import type { PrismaClient } from "@uwe/database/server";

export interface SecurityDashboardAccess {
  allowed: boolean;
  userRole: string | null;
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
      userRole: null,
      displayName: null,
      reason: "Kein Portal-Login — nur OWNER/ADMIN mit gültiger Session.",
    };
  }

  const auth = createAuthService(db);
  const session = await auth.getSessionByToken(token);

  if (!session) {
    return {
      allowed: false,
      userRole: null,
      displayName: null,
      reason: "Session abgelaufen oder ungültig — bitte im Portal anmelden.",
    };
  }

  const role = session.user.role;
  if (!canAccessSecurityDashboard(role)) {
    return {
      allowed: false,
      userRole: role,
      displayName: session.user.displayName,
      reason: `Rolle ${role} hat keinen Zugriff — nur OWNER und ADMIN.`,
    };
  }

  return {
    allowed: true,
    userRole: role,
    displayName: session.user.displayName,
    reason: "Zugriff erlaubt",
  };
}
