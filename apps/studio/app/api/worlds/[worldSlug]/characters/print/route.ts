import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  buildCharacterSheetMarkdown,
  buildCharacterSheetPrintHtml,
  createCharacterService,
  createPartyTreasuryService,
  createPrismaClient,
  getAppRepository,
  toPortalCharacterView,
} from "@uwe/database/server";
import { characterSheetPrintQuerySchema, parseQuery } from "@uwe/security";
import { requireStudioWorldRead } from "@/src/lib/authz";

export async function GET(
  request: Request,
  context: { params: Promise<{ worldSlug: string }> },
) {
  const authError = await guardStudioApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const { worldSlug } = await context.params;
    await requireStudioWorldRead(worldSlug);

    const parsed = parseQuery(request.url, characterSheetPrintQuerySchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const repo = getAppRepository();
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      return jsonError("Welt nicht gefunden.", 404);
    }

    const db = createPrismaClient();
    try {
      const characters = createCharacterService(db);
      const record = await characters.getById(parsed.data.characterId);
      if (!record || record.worldId !== world.id) {
        return jsonError("Charakter nicht gefunden.", 404);
      }

      const character = toPortalCharacterView(record);
      const inventory = createPartyTreasuryService(db);
      const inventoryItems = (await inventory.listItemsForCharacter(record.id)).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        notes: item.notes,
      }));

      if (parsed.data.format === "markdown") {
        return new NextResponse(
          buildCharacterSheetMarkdown({ character, inventoryItems, worldName: world.name }),
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
        worldName: world.name,
      });

      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } finally {
      await db.$disconnect();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Druckansicht fehlgeschlagen.";
    return jsonError(message, 403);
  }
}
