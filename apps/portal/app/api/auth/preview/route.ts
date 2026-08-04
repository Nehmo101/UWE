import { NextResponse } from "next/server";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import { cookies } from "next/headers";
import { createAuthService } from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import {
  getSessionCookieOptionsForRequest,
  PREVIEW_COOKIE_NAME,
  canPreviewAsPlayer,
} from "@uwe/auth";
import { getAccessContextForWorld } from "@/src/lib/auth";

export async function POST(request: Request) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

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
    const db = getSharedPrismaClient();
    const auth = createAuthService(db);
    try {
      const players = await auth.listWorldPlayers(worldSlug);
      const allowed = players.some((entry) => entry.user.id === previewAsUserId);
      if (!allowed) {
        return NextResponse.json({ error: "Spieler nicht in dieser Welt." }, { status: 400 });
      }
    } finally {
      await disconnectPrismaClientIfOwned(db);
    }
  }

  const cookieStore = await cookies();
  if (previewAsUserId) {
    cookieStore.set(PREVIEW_COOKIE_NAME, previewAsUserId, {
      ...getSessionCookieOptionsForRequest(request),
    });
  } else {
    cookieStore.delete(PREVIEW_COOKIE_NAME);
  }

  return NextResponse.json({ ok: true, previewAsUserId });
}
