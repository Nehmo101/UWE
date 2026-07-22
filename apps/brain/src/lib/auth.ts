import { cache } from "react";
import { cookies } from "next/headers";
import { createAuthService } from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { SESSION_COOKIE_NAME } from "@uwe/auth";

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

export { SESSION_COOKIE_NAME };
