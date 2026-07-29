import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import {
  getSessionCookieClearVariants,
  readSessionTokensFromCookieHeader,
  SESSION_COOKIE_NAME,
} from "@uwe/auth";
import { requireSameOriginMutation } from "@uwe/security";

export async function POST(request: Request) {
  const csrfError = requireSameOriginMutation(request);
  if (csrfError) {
    return csrfError;
  }

  const cookieStore = await cookies();
  // Every token the browser presented, not just the one `cookies()` collapses to:
  // a duplicated cookie would otherwise leave its session row alive.
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
  }

  return NextResponse.json({ ok: true });
}
