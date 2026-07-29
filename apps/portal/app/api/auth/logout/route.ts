import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import {
  getSessionCookieClearVariants,
  PREVIEW_COOKIE_NAME,
  readSessionTokensFromCookieHeader,
  SESSION_COOKIE_NAME,
} from "@uwe/auth";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";

export async function POST(request: Request) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

  const cookieStore = await cookies();
  // Every token the browser presented, not just the one `cookies()` collapses to.
  const tokens = readSessionTokensFromCookieHeader(request.headers.get("cookie"));

  if (tokens.length > 0) {
    const db = createPrismaClient();
    const auth = createAuthService(db);
    try {
      for (const token of tokens) {
        await auth.deleteSession(token);
      }
    } finally {
      await db.$disconnect();
    }
  }

  for (const options of getSessionCookieClearVariants(request)) {
    cookieStore.set(SESSION_COOKIE_NAME, "", { ...options, maxAge: 0 });
    cookieStore.set(PREVIEW_COOKIE_NAME, "", { ...options, maxAge: 0 });
  }

  return NextResponse.json({ ok: true });
}
