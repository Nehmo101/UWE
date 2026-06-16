import { createAuthService, createPrismaClient } from "@uwe/database/server";
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

  const db = createPrismaClient();
  const auth = createAuthService(db);
  try {
    const session = await auth.getSessionByToken(decodeURIComponent(token));
    return session ? auth.toAuthUser(session.user) : null;
  } finally {
    await db.$disconnect();
  }
}
