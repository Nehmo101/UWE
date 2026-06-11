import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { PREVIEW_COOKIE_NAME, SESSION_COOKIE_NAME } from "@uwe/auth";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const db = createPrismaClient();
    const auth = createAuthService(db);
    try {
      await auth.deleteSession(token);
    } finally {
      await db.$disconnect();
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(PREVIEW_COOKIE_NAME);

  return NextResponse.json({ ok: true });
}
