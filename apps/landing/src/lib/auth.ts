import { cache } from "react";
import { cookies } from "next/headers";
import { createAuthService } from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { SESSION_COOKIE_NAME, type AuthUser } from "@uwe/auth";

/**
 * Session-Leser der Startseite. Bewusst minimal: die Landing ist anonym
 * erreichbar und kennt keine geschützten Routen — sie will nur wissen, ob ein
 * Besucher bereits angemeldet ist, um ihn direkt in „seine" App zu schicken.
 * Das Rollen-Gate liegt in den Ziel-Apps (Studio/Portal/Brain), nicht hier.
 */
export const getCurrentAuthUser = cache(async (): Promise<AuthUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const db = getSharedPrismaClient();
  const auth = createAuthService(db);
  try {
    const session = await auth.getSessionByToken(token);
    return session ? auth.toAuthUser(session.user) : null;
  } catch {
    // Kalter Start ohne DB darf die öffentliche Startseite nicht kippen —
    // der Besucher sieht dann schlicht die Auswahl statt einer Weiterleitung.
    return null;
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
});
