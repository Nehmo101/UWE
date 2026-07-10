import { createAuthService, prisma } from "@uwe/database/server";
import type { AuthUser } from "@uwe/auth";
import { SESSION_COOKIE_NAME } from "@uwe/auth";

export async function getUserFromRequestCookieHeader(
  cookieHeader: string | null,
): Promise<AuthUser | null> {
  if (!cookieHeader) {
    return null;
  }

  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  if (!token) {
    return null;
  }

  // Use the process-wide shared SQLite client instead of opening (and tearing
  // down) a fresh connection on every authenticated request — the per-request
  // client pattern here caused the SQLITE_BUSY "lock storm" the singleton in
  // @uwe/database/client.ts is designed to avoid (audit M2).
  const auth = createAuthService(prisma);
  const session = await auth.getSessionByToken(decodeURIComponent(token));
  return session ? auth.toAuthUser(session.user) : null;
}
