import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { SESSION_COOKIE_NAME } from "@uwe/auth";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);
  try {
    const touched = await auth.touchSession(token);
    if (!touched) {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return NextResponse.json({ ok: false, reason: "expired" }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } finally {
    await db.$disconnect();
  }
}
