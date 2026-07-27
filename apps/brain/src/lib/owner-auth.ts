import { NextResponse } from "next/server";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getSessionToken } from "@/src/lib/auth";
import { canEnterBrain } from "@/src/lib/owner";

/**
 * Brain needs the `brain` checkbox: every Brain route, API and server action
 * requires an authenticated session whose address holds it. Anyone else
 * receives 401/403.
 */
export async function requireBrainOwnerAuth(): Promise<NextResponse | null> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }

  const db = createPrismaClient();
  try {
    const auth = createAuthService(db);
    const session = await auth.getSessionByToken(token);
    if (!session?.user || !canEnterBrain(session.user)) {
      return NextResponse.json(
        { error: "Kein Zugang zum Bereich Brain." },
        { status: 403 },
      );
    }
    return null;
  } finally {
    await db.$disconnect();
  }
}
