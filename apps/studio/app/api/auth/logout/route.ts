import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getSessionCookieOptionsForRequest, SESSION_COOKIE_NAME } from "@uwe/auth";
import { requireSameOriginMutation } from "@uwe/security";

export async function POST(request: Request) {
  const csrfError = requireSameOriginMutation(request);
  if (csrfError) {
    return csrfError;
  }

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

  return NextResponse.json({ ok: true });
}
