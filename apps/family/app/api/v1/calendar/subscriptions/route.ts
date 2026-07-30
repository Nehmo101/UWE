import { NextResponse } from "next/server";
import { familyPrisma } from "@uwe/database/family-client";
import { createFamilyCalendarSubscriptionService } from "@uwe/family-core";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Kalender-Abos (ICS) auflisten und anlegen.
 *
 * Der Klartext-Token steht ausschließlich in der Antwort auf `POST` — danach
 * ist er nicht mehr abrufbar, gespeichert wird nur sein Hash. Deshalb eine
 * Route und keine Server Action: eine Action könnte den Wert nur über die URL
 * zurückgeben, und dort landete er im Browser-Verlauf.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_calendar"] });
  if (denied) return denied;

  const rows = await createFamilyCalendarSubscriptionService(familyPrisma).listSubscriptions();

  return NextResponse.json({
    subscriptions: rows.map((row) => ({
      id: row.id,
      label: row.label,
      tokenPrefix: row.tokenPrefix,
      member: row.member,
      isActive: row.isActive,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_calendar"] });
  if (denied) return denied;

  let body: { label?: unknown; memberId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfragekörper." }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label : "";
  const memberId = typeof body.memberId === "string" && body.memberId !== "" ? body.memberId : null;

  const created = await createFamilyCalendarSubscriptionService(familyPrisma).createSubscription({
    label,
    memberId,
  });

  return NextResponse.json(
    {
      id: created.id,
      label: created.label,
      memberId: created.memberId,
      // Einmalig. Wer ihn verliert, legt ein neues Abo an.
      token: created.token,
    },
    { status: 201 },
  );
}
