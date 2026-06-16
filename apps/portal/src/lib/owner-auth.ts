import { NextResponse } from "next/server";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getSessionToken } from "@/src/lib/auth";

/** Global system owner — maps to ADMIN/OWNER in deployment docs. */
export function isSystemOwner(role: string | undefined | null): boolean {
  return role === "owner";
}

/**
 * Private health for Portal: session cookie + global role `owner` only.
 * DM/player sessions receive 403.
 */
export async function requirePortalOwnerAuth(): Promise<NextResponse | null> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }

  const db = createPrismaClient();
  try {
    const auth = createAuthService(db);
    const session = await auth.getSessionByToken(token);
    if (!session?.user || !isSystemOwner(session.user.role)) {
      return NextResponse.json(
        { error: "Nur System-Owner dürfen den privaten Healthcheck abrufen." },
        { status: 403 },
      );
    }
    return null;
  } finally {
    await db.$disconnect();
  }
}
