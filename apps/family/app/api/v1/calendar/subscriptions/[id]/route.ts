import { NextResponse } from "next/server";
import { familyPrisma } from "@uwe/database/family-client";
import { createFamilyCalendarSubscriptionService } from "@uwe/family-core";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Ein Kalender-Abo widerrufen (`PATCH`) oder ganz entfernen (`DELETE`).
 *
 * Widerrufen ist der Regelfall: das Abo bleibt in der Liste sichtbar, damit
 * nachvollziehbar bleibt, welches Gerät es einmal gab. Der Feed antwortet
 * danach mit 404, als hätte es den Token nie gegeben.
 */

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_calendar"] });
  if (denied) return denied;

  const { id } = await context.params;
  const service = createFamilyCalendarSubscriptionService(familyPrisma);

  try {
    const revoked = await service.revokeSubscription(id);
    return NextResponse.json({ id: revoked.id, isActive: revoked.isActive });
  } catch {
    return NextResponse.json({ error: "Abo nicht gefunden." }, { status: 404 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_calendar"] });
  if (denied) return denied;

  const { id } = await context.params;

  try {
    await createFamilyCalendarSubscriptionService(familyPrisma).deleteSubscription(id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Abo nicht gefunden." }, { status: 404 });
  }
}
