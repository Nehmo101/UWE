import { NextResponse } from "next/server";
import { familyPrisma } from "@uwe/database/family-client";
import { createShoppingService } from "@uwe/kitchen";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Einzelne Einkaufsposition abhaken (oder den Haken zurücknehmen).
 *
 * Bewusst `checked` als Zielwert statt Toggle: ein Kiosk mit zwischengespeichertem
 * Stand darf beim Nachziehen nichts versehentlich umkehren.
 */

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_write"] });
  if (denied) return denied;

  let body: { checked?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfragekörper." }, { status: 400 });
  }

  if (typeof body.checked !== "boolean") {
    return NextResponse.json({ error: "checked (true/false) fehlt." }, { status: 400 });
  }

  const { id } = await context.params;
  const item = await createShoppingService(familyPrisma).setItemChecked(id, body.checked);
  if (!item) {
    return NextResponse.json({ error: "Position nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ id: item.id, name: item.name, checked: item.checked });
}
