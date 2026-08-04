import { NextResponse } from "next/server";
import { createAuthService } from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { getSessionToken } from "@/src/lib/auth";

/**
 * Private health for Portal: session cookie + the owner flag only.
 * Every other session receives 403.
 */
export async function requirePortalOwnerAuth(): Promise<NextResponse | null> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }

  const db = getSharedPrismaClient();
  try {
    const auth = createAuthService(db);
    const session = await auth.getSessionByToken(token);
    if (!session?.user?.isOwner) {
      return NextResponse.json(
        { error: "Nur System-Owner dürfen den privaten Healthcheck abrufen." },
        { status: 403 },
      );
    }
    return null;
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
}
