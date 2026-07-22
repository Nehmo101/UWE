import { NextResponse } from "next/server";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getSessionToken } from "@/src/lib/auth";
import { isBrainOwner } from "@/src/lib/owner";

/**
 * Brain is owner-only: every Brain route/API/action requires an authenticated
 * session whose user has the global role `owner`. Anyone else receives 401/403.
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
    if (!session?.user || !isBrainOwner(session.user.role)) {
      return NextResponse.json(
        { error: "Der Brain-Bereich ist nur für den System-Owner." },
        { status: 403 },
      );
    }
    return null;
  } finally {
    await db.$disconnect();
  }
}
