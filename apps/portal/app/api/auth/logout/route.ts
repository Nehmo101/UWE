import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getSessionCookieOptionsForRequest, PREVIEW_COOKIE_NAME, SESSION_COOKIE_NAME } from "@uwe/auth";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";

export async function POST(request: Request) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const cookieOptions = getSessionCookieOptionsForRequest(request);

  if (token) {
    const db = createPrismaClient();
    const auth = createAuthService(db);
    try {
      await auth.deleteSession(token);
    } finally {
      await db.$disconnect();
    }
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
  cookieStore.set(PREVIEW_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });

  return NextResponse.json({ ok: true });
}
