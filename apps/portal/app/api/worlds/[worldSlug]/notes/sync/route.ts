import { NextResponse } from "next/server";
import { createAuthService } from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { applyNoteSyncOperations } from "@uwe/player-hub";
import { parseBody, playerNoteSyncSchema } from "@uwe/security";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";

/**
 * Nachtrag aus dem Tischmodus: Notizen, die ohne Netz entstanden sind.
 *
 * Warum eine Route und keine Server Action: ohne Netz gibt es keine Action —
 * der Client muss die Einträge sammeln und später selbst abschicken. Der
 * CSRF-Schutz bleibt derselbe, `requirePortalApiAuth` weist Cross-Site-POSTs
 * ab. Entschieden wird in `@uwe/player-hub`; hier wird nur durchgereicht.
 *
 * Jeder Eintrag bekommt eine eigene Antwort (`applied` / `conflict` /
 * `denied`), damit der Client seine Warteschlange gezielt leeren kann statt
 * alles noch einmal zu schicken.
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ worldSlug: string }> },
) {
  const authError = await requirePortalApiAuth(request);
  if (authError) {
    return authError;
  }

  const { worldSlug } = await context.params;
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const parsed = await parseBody(request, playerNoteSyncSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const db = getSharedPrismaClient();

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      return NextResponse.json({ error: "Welt nicht gefunden." }, { status: 404 });
    }

    assertPortalCanReadWorld(ctx, world.id);

    const results = await applyNoteSyncOperations({
      target: createAuthService(db),
      worldSlug,
      ctx,
      viewerUserId: ctx.user?.id ?? null,
      operations: parsed.data.operations,
    });

    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
}
