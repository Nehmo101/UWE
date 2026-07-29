import { createAuthService, prisma } from "@uwe/database/server";
import type { AuthUser } from "@uwe/auth";
import { readSessionTokensFromCookieHeader } from "@uwe/auth";

export async function getUserFromRequestCookieHeader(
  cookieHeader: string | null,
): Promise<AuthUser | null> {
  // Use the process-wide shared SQLite client instead of opening (and tearing
  // down) a fresh connection on every authenticated request — the per-request
  // client pattern here caused the SQLITE_BUSY "lock storm" the singleton in
  // @uwe/database/client.ts is designed to avoid (audit M2).
  const auth = createAuthService(prisma);

  // Candidates are LAST-first, matching what `cookies()` resolves on the page path.
  // Trying the remaining ones keeps a duplicated cookie (host-only + domain-scoped)
  // from 401ing every API guard while the page authenticates fine.
  for (const token of readSessionTokensFromCookieHeader(cookieHeader)) {
    const session = await auth.getSessionByToken(token);
    if (session) {
      return auth.toAuthUser(session.user);
    }
  }

  return null;
}
