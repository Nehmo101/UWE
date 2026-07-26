import { readSessionTokensFromCookieHeader } from "@uwe/auth";
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

export async function evaluateMaintenanceForRequest(input: {
  surface: MaintenanceAppSurface;
  pathname: string;
  cookieHeader?: string | null;
  db?: PrismaClient;
}): Promise<MaintenanceGateDecision> {
  const db = input.db ?? createPrismaClient();
  const ownsConnection = !input.db;

  try {
    const [{ settings }, isOwner] = await Promise.all([
      getSystemSettingsSnapshot(db),
      resolveIsOwnerFromCookie(input.cookieHeader, db),
    ]);

    return evaluateMaintenanceGate({
      settings,
      surface: input.surface,
      pathname: input.pathname,
      context: resolveMaintenanceGateContext({ isOwner }),
    });
  } finally {
    if (ownsConnection) {
      await disconnectPrismaClientIfOwned(db);
    }
  }
}

async function resolveIsOwnerFromCookie(
  cookieHeader: string | null | undefined,
  db: PrismaClient,
): Promise<boolean> {
  const auth = createAuthService(db);

  // LAST-first, like `cookies()`; a stale duplicate must not make a signed-in
  // owner look anonymous — that would redirect them to /maintenance app-wide.
  for (const token of readSessionTokensFromCookieHeader(cookieHeader)) {
    const session = await auth.getSessionByToken(token);
    if (session) {
      return session.user.isOwner === true;
    }
  }

  return false;
}
