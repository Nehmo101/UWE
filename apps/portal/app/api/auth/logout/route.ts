import { NextResponse } from "next/server";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import { cookies } from "next/headers";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getSessionCookieOptions, PREVIEW_COOKIE_NAME, SESSION_COOKIE_NAME } from "@uwe/auth";
import { requirePortalApiAuth } from "@uwe/security";

export async function POST(request: Request) {
  const csrfError = requirePortalApiAuth(request);
  if (csrfError) return csrfError;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const cookieOptions = getSessionCookieOptions();

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
