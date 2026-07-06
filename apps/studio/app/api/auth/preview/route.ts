import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { cookies } from "next/headers";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import {
  canPreviewAsPlayer,
  getSessionCookieOptionsForRequest,
  PREVIEW_COOKIE_NAME,
} from "@uwe/auth";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";

export async function POST(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const body = (await request.json()) as { worldSlug?: string; previewAsUserId?: string | null };
  const worldSlug = body.worldSlug?.trim();
  const previewAsUserId = body.previewAsUserId ?? null;

  if (!worldSlug) {
    return jsonError("worldSlug ist erforderlich.", 400);
  }

  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx || !canPreviewAsPlayer(ctx)) {
    return jsonError("Keine Berechtigung für Preview-as-Player.", 403);
  }

  if (previewAsUserId) {
    const db = createPrismaClient();
    const auth = createAuthService(db);
    try {
      const players = await auth.listWorldPlayers(worldSlug);
      const allowed = players.some((entry) => entry.user.id === previewAsUserId);
      if (!allowed) {
        return jsonError("Spieler nicht in dieser Welt.", 400);
      }
    } finally {
      await db.$disconnect();
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
