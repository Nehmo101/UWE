import { NextResponse } from "next/server";
import { familyPrisma } from "@uwe/database/family-client";
import { createShoppingService } from "@uwe/kitchen";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Einkaufsliste lesen und ergänzen.
 *
 * Der häufigste Fall von aussen: „setz Milch auf die Liste". Ohne `listId`
 * landet der Eintrag auf der zuletzt angelegten offenen Liste — sonst müsste
 * der Aufrufer erst nachschlagen, welche gerade aktuell ist.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_read"] });
  if (denied) return denied;

  const service = createShoppingService(familyPrisma);
  const url = new URL(request.url);
  const listId = url.searchParams.get("listId");

  // Ohne `listId` nur die Uebersicht — die Positionen einer Liste kosten einen
  // eigenen Aufruf, sonst zieht ein Blick auf die Listen die ganze Historie mit.
  if (!listId) {
    const lists = await service.listLists();
    return NextResponse.json({ lists });
  }

  const list = await service.getList(listId);
  if (!list) {
    return NextResponse.json({ error: "Liste nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({
    list: {
      id: list.id,
      title: list.title,
      done: list.done,
      items: list.items.map((item) => ({
        id: item.id,
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        // Freitext-Einheit („2 Packungen") — beim Schreiben angenommen, also
        // auch beim Lesen sichtbar.
        unitLabel: item.unitLabel,
        category: item.category,
        // Großeinkauf (`main`) vs. Frische-Einkauf (`fresh`).
        trip: item.trip,
        checked: item.checked,
      })),
    },
  });
}

export async function POST(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_write"] });
  if (denied) return denied;

  let body: { name?: unknown; amount?: unknown; unit?: unknown; listId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfragekörper." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name === "") {
    return NextResponse.json({ error: "name fehlt." }, { status: 400 });
  }

  const service = createShoppingService(familyPrisma);
  let listId = typeof body.listId === "string" ? body.listId : "";


  if (listId === "") {
    const lists = await service.listLists();
    const open = lists.find((list) => !list.done);
    listId = open?.id ?? (await service.createManualList()).id;
  }

  const item = await service.addItem({
    listId,
    name,
    amount: typeof body.amount === "number" ? body.amount : null,
    // Die Einheit ist ein enger Aufzaehlungstyp; freier Text kommt als
    // `unitLabel` durch, damit „2 Packungen" nicht an der Validierung scheitert.
    unitLabel: typeof body.unit === "string" ? body.unit : null,
  });

  return NextResponse.json({ id: item.id, listId, name: item.name }, { status: 201 });
}
