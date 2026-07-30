import { cache } from "react";
import { cookies } from "next/headers";
import { createAuthService } from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { SESSION_COOKIE_NAME, readSessionTokensFromCookieHeader } from "@uwe/auth";
import type { SafeUser } from "@uwe/auth";

export const getSessionToken = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
});

export const getCurrentSession = cache(async () => {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const db = getSharedPrismaClient();
  const auth = createAuthService(db);
  try {
    const session = await auth.getSessionByToken(token);
    if (!session) {
      return null;
    }
    return { id: session.id, user: session.user };
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
});

export const getCurrentUser = cache(async () => {
  const session = await getCurrentSession();
  return session?.user ?? null;
});

/**
 * Benutzer aus dem rohen Cookie-Header — für Route-Handler, die keinen Zugriff
 * auf `cookies()` haben oder mehrere Sitzungs-Cookies auflösen müssen.
 * Spiegel von `apps/portal/src/lib/auth.ts`.
 */
export async function getUserFromRequestCookieHeader(
  cookieHeader: string | null,
): Promise<SafeUser | null> {
  const db = getSharedPrismaClient();
  const auth = createAuthService(db);
  try {
    // Letztes Cookie zuerst — dieselbe Reihenfolge, die `cookies()` auflöst.
    for (const token of readSessionTokensFromCookieHeader(cookieHeader)) {
      const session = await auth.getSessionByToken(token);
      if (session) {
        return session.user;
      }
    }
    return null;
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
}

export { SESSION_COOKIE_NAME };
