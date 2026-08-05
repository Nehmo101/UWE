import { NextResponse } from "next/server";
import { familyPrisma } from "@uwe/database/family-client";
import { createFamilyCalDavAccountService } from "@uwe/family-core";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Einen CalDAV-Zugang widerrufen (`PATCH`) oder ganz entfernen (`DELETE`).
 *
 * Widerrufen ist der Regelfall: der Zugang bleibt in der Liste sichtbar, damit
 * nachvollziehbar bleibt, welches Gerät es einmal gab. Der DAV-Endpunkt
 * antwortet danach mit 401 wie bei jedem unbekannten Token.
 */

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_calendar"] });
  if (denied) return denied;

  const { id } = await context.params;

  try {
    const revoked = await createFamilyCalDavAccountService(familyPrisma).revokeAccount(id);
    return NextResponse.json({ id: revoked.id, isActive: revoked.isActive });
  } catch {
    return NextResponse.json({ error: "Zugang nicht gefunden." }, { status: 404 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_calendar"] });
  if (denied) return denied;

  const { id } = await context.params;

  try {
    await createFamilyCalDavAccountService(familyPrisma).deleteAccount(id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Zugang nicht gefunden." }, { status: 404 });
  }
}
