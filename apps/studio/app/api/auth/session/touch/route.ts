import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import {
  getSessionCookieClearVariants,
  readSessionTokensFromCookieHeader,
  SESSION_COOKIE_NAME,
} from "@uwe/auth";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const cookieStore = await cookies();
  const tokens = readSessionTokensFromCookieHeader(request.headers.get("cookie"));

  if (tokens.length === 0) {
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);
  try {
    // A stale duplicate must not report "expired" while the real session is alive.
    for (const token of tokens) {
      if (await auth.touchSession(token)) {
        return NextResponse.json({ ok: true });
      }
    }

    // `delete()` without options only ever matches the host-only cookie, so clear
    // every scope the session may have been written under.
    for (const options of getSessionCookieClearVariants(request)) {
      cookieStore.set(SESSION_COOKIE_NAME, "", { ...options, maxAge: 0 });
    }
    return NextResponse.json({ ok: false, reason: "expired" }, { status: 401 });
  } finally {
    await db.$disconnect();
  }
}
