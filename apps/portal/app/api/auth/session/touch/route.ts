import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthService } from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { SESSION_COOKIE_NAME } from "@uwe/auth";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";

export async function POST(request: Request) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }

  const db = getSharedPrismaClient();
  const auth = createAuthService(db);
  try {
    const touched = await auth.touchSession(token);
    if (!touched) {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return NextResponse.json({ ok: false, reason: "expired" }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
}
