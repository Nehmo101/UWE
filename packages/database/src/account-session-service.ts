import type { PrismaClient } from "./client";
import { resolveSessionInactivityTimeoutMs, SettingsService } from "./settings-service";

export interface UserActiveSessionView {
  id: string;
  ipAddress: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

function isSessionStillActive(
  session: { expiresAt: Date; lastActiveAt: Date; createdAt: Date },
  inactivityMs: number,
  now: Date,
): boolean {
  if (session.expiresAt <= now) {
    return false;
  }

  const lastActiveAt = session.lastActiveAt ?? session.createdAt;
  if (inactivityMs > 0 && now.getTime() - lastActiveAt.getTime() >= inactivityMs) {
    return false;
  }

  return true;
}

export async function listActiveSessionsForUser(
  db: PrismaClient,
  userId: string,
  options: { currentSessionId?: string | null } = {},
): Promise<UserActiveSessionView[]> {
  const settings = await new SettingsService(db).getSettings();
  const inactivityMs = resolveSessionInactivityTimeoutMs(settings);
  const now = new Date();

  const sessions = await db.session.findMany({
    where: { userId },
    orderBy: [{ lastActiveAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      ipAddress: true,
      createdAt: true,
      lastActiveAt: true,
      expiresAt: true,
    },
  });

  return sessions
    .filter((session) => isSessionStillActive(session, inactivityMs, now))
    .map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      expiresAt: session.expiresAt,
      isCurrent: options.currentSessionId ? session.id === options.currentSessionId : false,
    }));
}
