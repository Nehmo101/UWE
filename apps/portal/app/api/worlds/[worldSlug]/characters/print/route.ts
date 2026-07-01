import { NextResponse } from "next/server";
import {
  buildCharacterSheetMarkdown,
  buildCharacterSheetPrintHtml,
  createAuthService,
  createPartyTreasuryService,
  createPrismaClient,
} from "@uwe/database/server";
import { characterSheetPrintQuerySchema, parseQuery } from "@uwe/security";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";

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

  const parsed = parseQuery(request.url, characterSheetPrintQuerySchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  try {
    const character = await auth.getCharacterForViewer(worldSlug, parsed.data.characterId, ctx);
    if (!character) {
      return NextResponse.json({ error: "Charakter nicht gefunden." }, { status: 404 });
    }

    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { name: true },
    });

    const inventory = createPartyTreasuryService(db);
    const inventoryItems = (await inventory.listItemsForCharacter(character.id)).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      notes: item.notes,
    }));

    if (parsed.data.format === "markdown") {
      return new NextResponse(
        buildCharacterSheetMarkdown({
          character,
          inventoryItems,
          worldName: world?.name,
        }),
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `inline; filename="${character.displayName}-charakterbogen.md"`,
          },
        },
      );
    }

    const html = buildCharacterSheetPrintHtml({
      character,
      inventoryItems,
      worldName: world?.name,
    });

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } finally {
    await db.$disconnect();
  }
}
