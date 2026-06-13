import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import {
  getSessionCookieOptions,
  PREVIEW_COOKIE_NAME,
  canPreviewAsPlayer,
} from "@uwe/auth";
import { getAccessContextForWorld } from "@/src/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { worldSlug?: string; previewAsUserId?: string | null };
  const worldSlug = body.worldSlug?.trim();
  const previewAsUserId = body.previewAsUserId ?? null;

  if (!worldSlug) {
    return NextResponse.json({ error: "worldSlug ist erforderlich." }, { status: 400 });
  }

  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx || !canPreviewAsPlayer(ctx)) {
    return NextResponse.json({ error: "Keine Berechtigung für Preview-as-Player." }, { status: 403 });
  }

  if (previewAsUserId) {
    const db = createPrismaClient();
    const auth = createAuthService(db);
    try {
      const players = await auth.listWorldPlayers(worldSlug);
      const allowed = players.some((entry) => entry.user.id === previewAsUserId);
      if (!allowed) {
        return NextResponse.json({ error: "Spieler nicht in dieser Welt." }, { status: 400 });
      }
    } finally {
      await db.$disconnect();
    }
  }

  const cookieStore = await cookies();
  if (previewAsUserId) {
    cookieStore.set(PREVIEW_COOKIE_NAME, previewAsUserId, {
      ...getSessionCookieOptions(),
    });
  } else {
    cookieStore.delete(PREVIEW_COOKIE_NAME);
  }

  return NextResponse.json({ ok: true, previewAsUserId });
}
