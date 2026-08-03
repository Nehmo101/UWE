import { NextResponse } from "next/server";
import {
  createAuthService,
  createPartyTreasuryService,
  createPrismaClient,
} from "@uwe/database/server";
import { buildPortalOfflineSnapshot } from "@uwe/player-hub";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";

/**
 * Abzug für den Tischmodus: was ein Spieler ohne Netz noch braucht.
 *
 * Gelesen wird ausschliesslich über die `…ForViewer`-Methoden — dieselben, die
 * auch die Portal-Seiten benutzen. Dieser Endpunkt entscheidet keine
 * Sichtbarkeit neu und fasst keine Rohtabelle an; `dm_only` kann also gar nicht
 * bis aufs Gerät durchrutschen.
 *
 * `no-store`: der Abzug landet absichtlich im Browser-Speicher des Spielers,
 * aber nicht in einem Zwischenspeicher unterwegs.
 */

export const dynamic = "force-dynamic";

export async function GET(
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

  const db = createPrismaClient();

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, name: true },
    });
    if (!world) {
      return NextResponse.json({ error: "Welt nicht gefunden." }, { status: 404 });
    }

    assertPortalCanReadWorld(ctx, world.id);

    const auth = createAuthService(db);
    const [characters, notes, treasury, campaigns] = await Promise.all([
      auth.listCharactersForViewer(worldSlug, ctx),
      auth.listPlayerNotesForViewer(worldSlug, ctx),
      createPartyTreasuryService(db).getForViewer(worldSlug, ctx),
      // Ohne Kampagne lässt sich offline nichts Neues anlegen — die Kennung
      // muss deshalb mit in den Abzug.
      db.campaign.findMany({ where: { world: { slug: worldSlug } }, select: { id: true }, take: 1 }),
    ]);

    const snapshot = buildPortalOfflineSnapshot({
      snapshotAt: new Date(),
      world: { slug: worldSlug, name: world.name },
      campaignId: campaigns[0]?.id ?? null,
      viewerUserId: ctx.user?.id ?? null,
      characters,
      notes,
      treasury,
    });

    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } finally {
    await db.$disconnect();
  }
}
