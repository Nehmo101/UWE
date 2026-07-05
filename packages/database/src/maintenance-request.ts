import { SESSION_COOKIE_NAME, type UweRole } from "@uwe/auth";
import { createAuthService } from "./auth";
import {
  createPrismaClient,
  disconnectPrismaClientIfOwned,
  type PrismaClient,
} from "./client";
import {
  evaluateMaintenanceGate,
  resolveMaintenanceGateContext,
  type MaintenanceAppSurface,
  type MaintenanceGateDecision,
} from "./maintenance-gate";
import { getSystemSettingsSnapshot } from "./settings-service";

function parseSessionToken(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  return token ? decodeURIComponent(token) : null;
}

export async function evaluateMaintenanceForRequest(input: {
  surface: MaintenanceAppSurface;
  pathname: string;
  cookieHeader?: string | null;
  db?: PrismaClient;
}): Promise<MaintenanceGateDecision> {
  const db = input.db ?? createPrismaClient();
  const ownsConnection = !input.db;

  try {
    const [{ settings }, userRole] = await Promise.all([
      getSystemSettingsSnapshot(db),
      resolveUserRoleFromCookie(input.cookieHeader, db),
    ]);

    return evaluateMaintenanceGate({
      settings,
      surface: input.surface,
      pathname: input.pathname,
      context: resolveMaintenanceGateContext({ userRole }),
    });
  } finally {
    if (ownsConnection) {
      await disconnectPrismaClientIfOwned(db);
    }
  }
}

async function resolveUserRoleFromCookie(
  cookieHeader: string | null | undefined,
  db: PrismaClient,
): Promise<UweRole | null> {
  const token = parseSessionToken(cookieHeader);
  if (!token) {
    return null;
  }

  const auth = createAuthService(db);
  const session = await auth.getSessionByToken(token);
  return session?.user.role ?? null;
}
